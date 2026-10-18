import { LitElement } from 'lit';
import { store as defaultStore, type PlaceStore } from '../data/store.ts';

/**
 * Base for screen components: renders into the light DOM (so the global
 * stylesheet applies) and re-renders whenever the store changes.
 */
export abstract class ScreenElement extends LitElement {
  static override properties = {
    store: { attribute: false },
  };

  declare store: PlaceStore;

  private unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.store = defaultStore;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private subscribeOnce(): void {
    if (this.unsubscribe || !this.store) return;
    this.unsubscribe = this.store.subscribe(() => this.requestUpdate());
  }

  protected override willUpdate(): void {
    this.subscribeOnce();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.subscribeOnce();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
