import { html } from 'lit';
import { LightElement, defineElement } from './base.ts';

/**
 * Lightweight snackbar (Material Web ships no snackbar). Announces messages to
 * assistive tech and offers a single optional action.
 */
export class M3Snackbar extends LightElement {
  private message = '';
  private actionLabel: string | null = null;
  private action: (() => void) | null = null;
  private open = false;
  private timer: number | null = null;

  show(message: string, actionLabel?: string, action?: () => void, timeout = 5000): void {
    this.message = message;
    this.actionLabel = actionLabel ?? null;
    this.action = action ?? null;
    this.open = true;
    this.requestUpdate();
    this.scheduleDismiss(timeout);
  }

  private scheduleDismiss(timeout: number): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.dismiss(), timeout);
  }

  dismiss(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.open = false;
    this.requestUpdate();
  }

  private runAction(): void {
    const action = this.action;
    this.dismiss();
    action?.();
  }

  protected override render() {
    return html`
      <div class="snackbar" data-open=${this.open ? 'true' : 'false'}>
        <span class="snackbar__message" role="status" aria-live="polite">${this.message}</span>
        ${this.actionLabel
          ? html`<md-text-button @click=${() => this.runAction()}>${this.actionLabel}</md-text-button>`
          : html`<md-icon-button aria-label="Dismiss message" @click=${() => this.dismiss()}>
              <md-icon>close</md-icon>
            </md-icon-button>`}
      </div>
    `;
  }
}

defineElement('m3-snackbar', M3Snackbar);
