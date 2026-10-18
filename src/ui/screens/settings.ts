import { html, type TemplateResult } from 'lit';
import { ImportError } from '../../data/exportImport.ts';
import { storageInfo, type StorageInfo } from '../../data/db.ts';
import { defineElement } from '../base.ts';
import { confirmDialog, notify } from '../dialogs.ts';
import { downloadTextFile, exportFilename } from '../download.ts';
import { ScreenElement } from '../screen.ts';

/** Settings: export, import, and irreversible data management. */
export class M3SettingsScreen extends ScreenElement {
  static override properties = {
    store: { attribute: false },
    status: { state: true },
    statusTone: { state: true },
    info: { state: true },
    busy: { state: true },
  };

  private declare status: string;
  private declare statusTone: 'info' | 'error' | 'success';
  private declare info: StorageInfo | null;
  private declare busy: boolean;

  constructor() {
    super();
    this.status = '';
    this.statusTone = 'info';
    this.info = null;
    this.busy = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void storageInfo().then((info) => {
      this.info = info;
    }).catch(() => {
      this.info = null;
    });
  }

  private exportData(): void {
    const places = this.store.getPlaces();
    if (places.length === 0) {
      this.status = 'There is nothing to export yet.';
      this.statusTone = 'info';
      return;
    }
    try {
      downloadTextFile(exportFilename(), this.store.exportToJson());
    } catch (error) {
      this.status = `Export failed: ${
        error instanceof Error ? error.message : 'the download could not be started.'
      }`;
      this.statusTone = 'error';
      return;
    }
    this.status = `Exported ${places.length} place${places.length === 1 ? '' : 's'}.`;
    this.statusTone = 'success';
  }

  private async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (this.busy) return;
    this.busy = true;
    this.status = `Reading ${file.name}…`;
    this.statusTone = 'info';
    try {
      const text = await file.text();
      const summary = this.store.parseImport(text);
      const existingIds = new Set(this.store.getPlaces().map((place) => place.id));
      const collisions = summary.places.filter((place) => existingIds.has(place.id)).length;
      if (collisions > 0) {
        const confirmed = await confirmDialog({
          headline: 'Replace existing places?',
          body:
            `${collisions} of the ${summary.places.length} imported place${summary.places.length === 1 ? '' : 's'} share ${collisions === 1 ? 'an id' : 'ids'} with place${collisions === 1 ? 's' : ''} already saved in this browser. Importing will overwrite those ${collisions === 1 ? 'current record' : 'current records'} with the version from the file; this cannot be undone.`,
          confirmLabel: 'Replace and import',
          cancelLabel: 'Cancel import',
        });
        if (!confirmed) {
          this.status = 'Import canceled. Your existing places were left unchanged.';
          this.statusTone = 'info';
          return;
        }
      }
      const result = await this.store.applyImport(summary);
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} added`);
      if (result.replaced > 0) parts.push(`${result.replaced} replaced`);
      if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
      const detail = parts.length > 0 ? parts.join(', ') : 'nothing to import';
      if (result.errors.length > 0) {
        this.status = `Import finished: ${detail}. First problem — ${result.errors[0]}`;
        this.statusTone = 'error';
      } else {
        this.status = `Import finished: ${detail}.`;
        this.statusTone = result.added + result.replaced > 0 ? 'success' : 'info';
      }
    } catch (error) {
      if (error instanceof ImportError) {
        this.status = error.message;
      } else {
        this.status = error instanceof Error ? error.message : 'The file could not be imported.';
      }
      this.statusTone = 'error';
    } finally {
      this.busy = false;
    }
  }

  private async clearAll(): Promise<void> {
    const count = this.store.getPlaces().length;
    const confirmed = await confirmDialog({
      headline: 'Delete all saved places?',
      body:
        count === 1
          ? 'This will permanently delete your single saved place from this browser. This cannot be undone.'
          : `This will permanently delete all ${count} saved places from this browser. This cannot be undone.`,
      confirmLabel: 'Delete all',
      cancelLabel: 'Keep my data',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await this.store.clearAll();
      this.status = 'All saved places were deleted.';
      this.statusTone = 'success';
      notify('All saved places deleted.');
    } catch (error) {
      this.status = error instanceof Error ? error.message : 'Could not delete your data.';
      this.statusTone = 'error';
    }
  }

  private openImportPicker(): void {
    this.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  }

  protected override render(): TemplateResult {
    const count = this.store.getPlaces().length;
    const info = this.info;
    return html`
      <section class="screen" aria-labelledby="settings-heading">
        <div class="content__inner">
          <div class="screen__header">
            <h2 class="screen__heading" id="settings-heading" tabindex="-1">Settings</h2>
            <p class="screen__subheading">Manage the places stored in this browser.</p>
          </div>

          <div class="settings-card">
            <h3 class="settings-card__title">Your data</h3>
            <p class="settings-card__body">
              ${count} place${count === 1 ? '' : 's'} stored locally.
              ${info && !info.supported
                ? 'Local storage (IndexedDB) is unavailable in this browser, so nothing can be saved.'
                : 'Records are kept in this browser only — there is no account and no server.'}
            </p>
          </div>

          <div class="settings-card">
            <h3 class="settings-card__title">Export</h3>
            <p class="settings-card__body">
              Download every saved place as a JSON file. The export stays on your device.
            </p>
            <div class="settings-card__actions">
              <md-outlined-button ?disabled=${count === 0} @click=${() => this.exportData()}>
                <md-icon slot="icon">download</md-icon>
                Export JSON
              </md-outlined-button>
            </div>
          </div>

          <div class="settings-card">
            <h3 class="settings-card__title">Import</h3>
            <p class="settings-card__body">
              Import places from a JSON file produced by this app. Records with the same id are
              replaced; invalid entries are skipped and reported.
            </p>
            <div class="settings-card__actions">
              <md-outlined-button ?disabled=${this.busy} @click=${() => this.openImportPicker()}>
                <md-icon slot="icon">upload</md-icon>
                Choose JSON file
              </md-outlined-button>
              <input
                type="file"
                accept="application/json,.json"
                class="sr-only"
                aria-label="Import places from a JSON file"
                @change=${(event: Event) => this.onFileChosen(event)}
              />
            </div>
            <p class="form-status" data-tone=${this.statusTone} role="status" aria-live="polite">
              ${this.status}
            </p>
          </div>

          <div class="settings-card settings-card--danger">
            <h3 class="settings-card__title">Delete all data</h3>
            <p class="settings-card__body">
              Permanently removes every saved place from this browser. Export first if you want a
              backup.
            </p>
            <div class="settings-card__actions">
              <md-filled-button
                class="dialog-confirm destructive"
                ?disabled=${count === 0}
                @click=${() => this.clearAll()}
              >
                <md-icon slot="icon">delete_forever</md-icon>
                Delete all places
              </md-filled-button>
            </div>
          </div>

          <div class="settings-card">
            <h3 class="settings-card__title">Limitations</h3>
            <ul class="settings-list">
              <li>Everything lives in this browser, on this device. There is no sync and no server storage.</li>
              <li>Clearing your browser data (site data, “clear browsing data”) will delete your places.</li>
              <li>Private/incognito windows discard data when you close them.</li>
              <li>Typed search is processed entirely in your browser — your query is never sent anywhere.</li>
              <li>Saved-place records and their exact stored coordinates stay on this device; they are never uploaded by this app.</li>
              <li>Map tiles are fetched from OpenStreetMap over the network. Each tile request sends your approximate viewport — which can reveal your approximate location when the map is centered on your current or a saved place — plus network metadata to OpenStreetMap servers.</li>
              <li>Voice search uses your browser's speech recognition. Depending on your browser, that service may be provided by your browser vendor and may send your audio off-device to recognize your speech.</li>
            </ul>
          </div>
        </div>
      </section>
    `;
  }
}

defineElement('m3-settings-screen', M3SettingsScreen);
