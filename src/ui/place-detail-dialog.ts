import { html, nothing } from 'lit';
import type { Place } from '../data/types.ts';
import { LightElement, defineElement } from './base.ts';
import { formatCoordLabel, formatDateTime, formatRelative } from './format.ts';

export type PlaceDetailAction = 'edit' | 'delete' | 'show-on-map' | 'close';

/** Read-only detail view of a single saved place with its primary actions. */
export class M3PlaceDetailDialog extends LightElement {
  static override properties = {
    place: { state: true },
  };

  private declare place: Place | null;
  private resolver: ((action: PlaceDetailAction) => void) | null = null;
  private previousFocus: HTMLElement | null = null;
  private action: PlaceDetailAction = 'close';

  constructor() {
    super();
    this.place = null;
  }

  async open(place: Place): Promise<PlaceDetailAction> {
    this.place = place;
    this.action = 'close';
    this.requestUpdate();
    await this.updateComplete;

    const dialog = this.querySelector<HTMLElement & { show(): Promise<void> }>('md-dialog');
    this.previousFocus = (document.activeElement as HTMLElement) ?? null;
    const settled = new Promise<PlaceDetailAction>((resolve) => {
      this.resolver = resolve;
    });
    await dialog?.show();
    return settled;
  }

  private choose(action: PlaceDetailAction): void {
    this.action = action;
    const dialog = this.querySelector<HTMLElement & { close(value?: string): Promise<void> }>('md-dialog');
    void dialog?.close(action);
  }

  private onClosed(event: Event): void {
    const dialog = event.target as HTMLElement & { returnValue: string };
    const value = (dialog.returnValue || this.action || 'close') as PlaceDetailAction;
    this.resolver?.(value);
    this.resolver = null;
    this.place = null;
    this.previousFocus?.focus?.();
    this.previousFocus = null;
    this.requestUpdate();
  }

  protected override render() {
    const place = this.place;
    if (!place) return html``;
    return html`
      <md-dialog @closed=${(event: Event) => this.onClosed(event)}>
        <div slot="headline" class="dialog-headline">${place.name}</div>
        <div slot="content" class="dialog-content">
          ${place.favorite ? html`<p class="dialog-supporting">★ Marked as favorite</p>` : nothing}
          <dl class="detail-list">
            <dt>Coordinates</dt>
            <dd class="detail-list__mono">${formatCoordLabel(place.lat, place.lng)}</dd>
            <dt>Latitude, Longitude</dt>
            <dd class="detail-list__mono">${place.lat}, ${place.lng}</dd>
            ${place.note ? html`<dt>Note</dt><dd>${place.note}</dd>` : nothing}
            <dt>Created</dt>
            <dd>${formatDateTime(place.createdAt)}</dd>
            <dt>Updated</dt>
            <dd>${formatRelative(place.updatedAt)} (${formatDateTime(place.updatedAt)})</dd>
          </dl>
        </div>
        <div slot="actions" class="dialog-actions dialog-actions--spread">
          <md-text-button @click=${() => this.choose('delete')}>
            <md-icon slot="icon">delete</md-icon>
            Delete
          </md-text-button>
          <span class="dialog-actions__group">
            <md-outlined-button @click=${() => this.choose('show-on-map')}>
              <md-icon slot="icon">map</md-icon>
              Show on map
            </md-outlined-button>
            <md-filled-button @click=${() => this.choose('edit')}>
              <md-icon slot="icon">edit</md-icon>
              Edit
            </md-filled-button>
          </span>
        </div>
      </md-dialog>
    `;
  }
}

defineElement('m3-place-detail-dialog', M3PlaceDetailDialog);
