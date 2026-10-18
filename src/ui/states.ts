import { html, type TemplateResult } from 'lit';

export function renderLoadingState(message = 'Loading your places…'): TemplateResult {
  return html`
    <div class="state" role="status" aria-live="polite">
      <md-icon class="state__icon" aria-hidden="true">hourglass_top</md-icon>
      <p class="state__title">${message}</p>
    </div>
  `;
}

export function renderErrorState(message: string, onRetry: () => void): TemplateResult {
  return html`
    <div class="status-banner" role="alert">
      <md-icon aria-hidden="true">error</md-icon>
      <div>
        <p class="state__title">Something went wrong</p>
        <p class="dialog-supporting">${message}</p>
      </div>
      <md-text-button @click=${onRetry}>
        <md-icon slot="icon">refresh</md-icon>
        Retry
      </md-text-button>
    </div>
  `;
}

export interface EmptyStateOptions {
  icon: string;
  title: string;
  body: string;
  actions?: TemplateResult;
}

export function renderEmptyState(options: EmptyStateOptions): TemplateResult {
  return html`
    <div class="state">
      <md-icon class="state__icon" aria-hidden="true">${options.icon}</md-icon>
      <p class="state__title">${options.title}</p>
      <p class="state__body">${options.body}</p>
      ${options.actions ? html`<div class="state__actions">${options.actions}</div>` : ''}
    </div>
  `;
}
