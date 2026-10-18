import { html } from 'lit';
import { getCurrentPosition } from '../data/geo.ts';
import { ValidationError } from '../data/store.ts';
import type { Place, PlaceFieldErrors, PlaceFormValues } from '../data/types.ts';
import { validatePlaceInput } from '../data/validation.ts';
import { LightElement, defineElement } from './base.ts';

export interface PlaceFormOpenOptions {
  mode: 'create' | 'edit';
  initial?: Place | null;
  prefill?: { lat: number; lng: number } | null;
  /** Persists the values. Throw ValidationError to keep the dialog open. */
  onSubmit: (values: PlaceFormValues) => Promise<void>;
}

const EMPTY_VALUES: PlaceFormValues = { name: '', lat: '', lng: '', note: '', favorite: false };

function toValues(place: Place | null | undefined): PlaceFormValues {
  if (!place) return { ...EMPTY_VALUES };
  return {
    name: place.name,
    lat: String(place.lat),
    lng: String(place.lng),
    note: place.note,
    favorite: place.favorite,
  };
}

/**
 * Create / edit dialog. Text fields are uncontrolled and read on submit, which
 * avoids caret jumps while typing; validation errors are surfaced inline and
 * invalid input is never persisted.
 */
export class M3PlaceFormDialog extends LightElement {
  static override properties = {
    errors: { state: true },
    statusMessage: { state: true },
    statusTone: { state: true },
    busy: { state: true },
    locating: { state: true },
    mode: { state: true },
  };

  private errors!: PlaceFieldErrors;
  private statusMessage!: string;
  private statusTone!: 'info' | 'error' | 'success';
  private busy!: boolean;
  private locating!: boolean;
  private mode!: 'create' | 'edit' | null;

  private options: PlaceFormOpenOptions | null = null;
  private values: PlaceFormValues = { ...EMPTY_VALUES };
  private resolver: ((saved: boolean) => void) | null = null;
  private previousFocus: HTMLElement | null = null;

  constructor() {
    super();
    this.errors = {};
    this.statusMessage = '';
    this.statusTone = 'info';
    this.busy = false;
    this.locating = false;
    this.mode = null;
  }

  async open(options: PlaceFormOpenOptions): Promise<boolean> {
    this.options = options;
    this.mode = options.mode;
    this.values = toValues(options.initial ?? null);
    if (options.prefill && !options.initial) {
      this.values = {
        ...this.values,
        lat: options.prefill.lat.toFixed(6),
        lng: options.prefill.lng.toFixed(6),
      };
    }
    this.errors = {};
    this.statusMessage = '';
    this.statusTone = 'info';
    this.busy = false;
    this.locating = false;
    this.requestUpdate();
    await this.updateComplete;
    this.applyValuesToFields();

    const dialog = this.querySelector<HTMLElement & { show(): Promise<void> }>('md-dialog');
    this.previousFocus = (document.activeElement as HTMLElement) ?? null;
    const settled = new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
    await dialog?.show();
    this.querySelector<HTMLElement & { focus(): void }>('md-outlined-text-field')?.focus?.();
    return settled;
  }

  private fieldFor(key: keyof PlaceFormValues): (HTMLElement & { value: string; selected: boolean }) | null {
    return this.querySelector<HTMLElement & { value: string; selected: boolean }>(`[data-field="${key}"]`);
  }

  private applyValuesToFields(): void {
    for (const key of Object.keys(this.values) as Array<keyof PlaceFormValues>) {
      const field = this.fieldFor(key);
      if (!field) continue;
      if (key === 'favorite') field.selected = this.values.favorite;
      else field.value = this.values[key];
    }
  }

  private settle(saved: boolean): void {
    this.resolver?.(saved);
    this.resolver = null;
    this.previousFocus?.focus?.();
    this.previousFocus = null;
  }

  private onClosed(event: Event): void {
    const dialog = event.target as HTMLElement & { returnValue: string };
    if (dialog.returnValue !== 'saved') {
      this.settle(false);
      this.options = null;
      this.mode = null;
      this.values = { ...EMPTY_VALUES };
      this.requestUpdate();
    }
  }

  private readValues(): PlaceFormValues {
    const name = this.fieldFor('name')?.value ?? '';
    const lat = this.fieldFor('lat')?.value ?? '';
    const lng = this.fieldFor('lng')?.value ?? '';
    const note = this.fieldFor('note')?.value ?? '';
    const favorite = this.fieldFor('favorite')?.selected ?? this.values.favorite;
    this.values = { name, lat, lng, note, favorite };
    return this.values;
  }

  private clearFieldError(key: keyof PlaceFieldErrors): void {
    if (this.errors[key]) {
      const next: PlaceFieldErrors = { ...this.errors };
      delete next[key];
      this.errors = next;
    }
  }

  private async useMyLocation(): Promise<void> {
    if (this.locating) return;
    this.locating = true;
    this.statusMessage = 'Getting your location…';
    this.statusTone = 'info';
    this.requestUpdate();
    try {
      const position = await getCurrentPosition();
      this.values = {
        ...this.readValues(),
        lat: position.lat.toFixed(6),
        lng: position.lng.toFixed(6),
      };
      this.clearFieldError('lat');
      this.clearFieldError('lng');
      this.applyValuesToFields();
      const accuracy = position.accuracy > 0 ? ` (±${Math.round(position.accuracy)} m)` : '';
      this.statusMessage = `Coordinates filled from your device${accuracy}.`;
      this.statusTone = 'success';
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : 'Could not get your location.';
      this.statusTone = 'error';
    } finally {
      this.locating = false;
      this.requestUpdate();
    }
  }

  private async submit(): Promise<void> {
    if (this.busy || !this.options) return;
    const values = this.readValues();
    const validation = validatePlaceInput(values);
    if (!validation.ok) {
      this.errors = validation.errors;
      this.statusMessage = 'Please fix the highlighted fields.';
      this.statusTone = 'error';
      this.requestUpdate();
      return;
    }

    this.busy = true;
    this.statusMessage = '';
    this.requestUpdate();
    try {
      await this.options.onSubmit(values);
      const dialog = this.querySelector<HTMLElement & { close(value?: string): Promise<void> }>('md-dialog');
      await dialog?.close('saved');
      this.settle(true);
      this.options = null;
      this.mode = null;
    } catch (error) {
      if (error instanceof ValidationError) {
        this.errors = error.errors;
        this.statusMessage = 'Please fix the highlighted fields.';
      } else {
        this.statusMessage = error instanceof Error ? error.message : 'Could not save the place.';
      }
      this.statusTone = 'error';
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  private cancel(): void {
    const dialog = this.querySelector<HTMLElement & { close(value?: string): Promise<void> }>('md-dialog');
    void dialog?.close('cancel');
  }

  protected override render() {
    if (!this.mode) return html``;
    const isEdit = this.mode === 'edit';
    return html`
      <md-dialog @closed=${(event: Event) => this.onClosed(event)}>
        <div slot="headline" class="dialog-headline">${isEdit ? 'Edit place' : 'New place'}</div>
        <div slot="content" class="dialog-content">
          <p class="dialog-supporting">
            ${isEdit
              ? 'Update the details for this saved place.'
              : 'Save a place with a name and coordinates. Click the map first to prefill coordinates.'}
          </p>
          <div class="form-grid">
            <md-outlined-text-field
              class="form-grid__full"
              data-field="name"
              label="Name"
              required
              .error=${Boolean(this.errors.name)}
              .errorText=${this.errors.name ?? ''}
            ></md-outlined-text-field>

            <md-outlined-text-field
              data-field="lat"
              label="Latitude"
              type="number"
              min="-90"
              max="90"
              step="any"
              .error=${Boolean(this.errors.lat)}
              .errorText=${this.errors.lat ?? ''}
              supporting-text="Between −90 and 90"
            ></md-outlined-text-field>

            <md-outlined-text-field
              data-field="lng"
              label="Longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
              .error=${Boolean(this.errors.lng)}
              .errorText=${this.errors.lng ?? ''}
              supporting-text="Between −180 and 180"
            ></md-outlined-text-field>

            <md-outlined-text-field
              class="form-grid__full"
              data-field="note"
              type="textarea"
              rows="3"
              label="Note (optional)"
              .error=${Boolean(this.errors.note)}
              .errorText=${this.errors.note ?? ''}
            ></md-outlined-text-field>
          </div>

          <div class="form-row form-row--between">
            <md-switch data-field="favorite">Favorite</md-switch>
          </div>

          <p class="form-status" data-tone=${this.statusTone} role="status" aria-live="polite">
            ${this.statusMessage}
          </p>
        </div>
        <div slot="actions" class="dialog-actions dialog-actions--spread">
          <md-outlined-button ?disabled=${this.locating} @click=${() => this.useMyLocation()}>
            <md-icon slot="icon">my_location</md-icon>
            ${this.locating ? 'Locating…' : 'Use my location'}
          </md-outlined-button>
          <span class="dialog-actions__group">
            <md-text-button @click=${() => this.cancel()}>Cancel</md-text-button>
            <md-filled-button ?disabled=${this.busy} @click=${() => this.submit()}>
              ${isEdit ? 'Save' : 'Add place'}
            </md-filled-button>
          </span>
        </div>
      </md-dialog>
    `;
  }
}

defineElement('m3-place-form-dialog', M3PlaceFormDialog);
