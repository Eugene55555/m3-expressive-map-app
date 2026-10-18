import { html } from 'lit';
import { LightElement, defineElement } from './base.ts';

export interface ConfirmOptions {
  headline: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/**
 * Promise-based confirmation dialog built on the standard `md-dialog`, so
 * focus trapping, scrim, Escape handling and return-focus come from Material.
 */
export class M3ConfirmDialog extends LightElement {
  private options: ConfirmOptions | null = null;
  private resolver: ((value: boolean) => void) | null = null;
  private previousFocus: HTMLElement | null = null;

  async ask(options: ConfirmOptions): Promise<boolean> {
    this.options = options;
    this.requestUpdate();
    await this.updateComplete;

    const dialog = this.querySelector<HTMLElement & { show(): Promise<void> }>('md-dialog');
    if (!dialog) return false;

    this.previousFocus = (document.activeElement as HTMLElement) ?? null;
    const settled = new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
    await dialog.show();
    return settled;
  }

  private settle(value: boolean): void {
    this.resolver?.(value);
    this.resolver = null;
  }

  private onClosed(event: Event): void {
    const dialog = event.target as HTMLElement & { returnValue: string };
    this.settle(dialog.returnValue === 'confirm');
    this.options = null;
    this.requestUpdate();
    this.previousFocus?.focus?.();
    this.previousFocus = null;
  }

  protected override render() {
    const options = this.options;
    if (!options) return html``;
    return html`
      <md-dialog @closed=${(event: Event) => this.onClosed(event)}>
        <div slot="headline" class="dialog-headline">${options.headline}</div>
        <div slot="content" class="dialog-content">
          <p class="dialog-supporting">${options.body}</p>
        </div>
        <div slot="actions" class="dialog-actions">
          <md-text-button @click=${() => this.closeWith('cancel')}>
            ${options.cancelLabel ?? 'Cancel'}
          </md-text-button>
          <md-filled-button
            class="dialog-confirm ${options.destructive ? 'destructive' : ''}"
            @click=${() => this.closeWith('confirm')}
          >
            ${options.confirmLabel}
          </md-filled-button>
        </div>
      </md-dialog>
    `;
  }

  private closeWith(returnValue: string): void {
    const dialog = this.querySelector<HTMLElement & { close(value?: string): Promise<void> }>('md-dialog');
    void dialog?.close(returnValue);
  }
}

defineElement('m3-confirm-dialog', M3ConfirmDialog);
