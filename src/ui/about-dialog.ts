import { html } from 'lit';
import { LightElement, defineElement } from './base.ts';

/** Informational dialog describing the app and its privacy model. */
export class M3AboutDialog extends LightElement {
  private resolver: (() => void) | null = null;
  private previousFocus: HTMLElement | null = null;
  private open_ = false;

  async open(): Promise<void> {
    this.open_ = true;
    this.requestUpdate();
    await this.updateComplete;

    const dialog = this.querySelector<HTMLElement & { show(): Promise<void> }>('md-dialog');
    this.previousFocus = (document.activeElement as HTMLElement) ?? null;
    const settled = new Promise<void>((resolve) => {
      this.resolver = resolve;
    });
    await dialog?.show();
    return settled;
  }

  private onClosed(): void {
    this.open_ = false;
    this.resolver?.();
    this.resolver = null;
    this.requestVisible();
    this.previousFocus?.focus?.();
    this.previousFocus = null;
  }

  private requestVisible(): void {
    this.requestUpdate();
  }

  private close(): void {
    const dialog = this.querySelector<HTMLElement & { close(value?: string): Promise<void> }>('md-dialog');
    void dialog?.close();
  }

  protected override render() {
    if (!this.open_) return html``;
    return html`
      <md-dialog @closed=${() => this.onClosed()}>
        <div slot="headline" class="dialog-headline">About &amp; privacy</div>
        <div slot="content" class="dialog-content">
          <p class="dialog-supporting">
            A personal map of the places you save, built with Material 3 Expressive and
            Material Web.
          </p>
          <ul class="settings-list">
            <li>Your saved place records, including the exact stored coordinates, remain in this browser on this device only (IndexedDB). There is no server and no account.</li>
            <li>Search runs locally; nothing you type is uploaded.</li>
            <li>Location is only read when you tap “Use my location” or “Center on me”.</li>
            <li>Map tiles come from OpenStreetMap and require a network connection; tile requests expose your approximate viewport and network metadata to OpenStreetMap servers.</li>
            <li>Voice search uses your browser's speech recognition. Depending on your browser, that service may be provided by your browser vendor and may process your audio remotely.</li>
            <li>Export regularly if you want a backup — clearing browser data removes your places.</li>
          </ul>
        </div>
        <div slot="actions" class="dialog-actions">
          <md-filled-button @click=${() => this.close()}>Close</md-filled-button>
        </div>
      </md-dialog>
    `;
  }
}

defineElement('m3-about-dialog', M3AboutDialog);

let aboutDialog: M3AboutDialog | null = null;

/** Open the shared about dialog, creating it on first use. */
export function openAboutDialog(): Promise<void> {
  if (!aboutDialog || !aboutDialog.isConnected) {
    aboutDialog = document.createElement('m3-about-dialog') as M3AboutDialog;
    document.body.append(aboutDialog);
  }
  return aboutDialog.open();
}
