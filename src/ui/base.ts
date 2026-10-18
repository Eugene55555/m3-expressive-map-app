import { LitElement } from 'lit';

/**
 * Lit base that renders into the light DOM so a single application stylesheet
 * can style the whole shell. Material Web components keep their own shadow DOM
 * and are themed through `--md-sys-color-*` tokens.
 */
export abstract class LightElement extends LitElement {
  protected override createRenderRoot(): HTMLElement {
    return this;
  }
}

export function defineElement(name: string, ctor: CustomElementConstructor): void {
  if (typeof customElements !== 'undefined' && !customElements.get(name)) {
    customElements.define(name, ctor);
  }
}
