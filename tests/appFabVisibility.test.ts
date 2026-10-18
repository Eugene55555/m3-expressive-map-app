import { render as litRender, type TemplateResult } from 'lit';
import { describe, expect, it } from 'vitest';
import { M3App } from '../src/ui/app.ts';
import type { Route } from '../src/ui/router.ts';

function renderAppForRoute(route: Route): HTMLElement {
  const app = new M3App();
  (app as unknown as { route: Route }).route = route;
  const container = document.createElement('div');
  litRender((app as unknown as { render: () => TemplateResult }).render(), container);
  return container;
}

describe('route-specific floating action button', () => {
  it('does not cover settings content with the add-place button', () => {
    const container = renderAppForRoute('settings');

    expect(container.querySelector('.app-fab')).toBeNull();
  });

  it('keeps the add-place button on the home screen', () => {
    const container = renderAppForRoute('home');

    expect(container.querySelector('.app-fab')).not.toBeNull();
  });
});
