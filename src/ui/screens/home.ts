import { html, type TemplateResult } from 'lit';
import { getCurrentPosition } from '../../data/geo.ts';
import { filterPlaces, sortPlaces } from '../../data/search.ts';
import { ScreenElement } from '../screen.ts';
import { defineElement } from '../base.ts';
import { emit } from '../events.ts';
import type { MapFocusRequest } from '../map.ts';
import { renderPlaceCard } from '../place-card.ts';
import { renderEmptyState, renderErrorState, renderLoadingState } from '../states.ts';

/**
 * Home: the map-centric overview. Map preview, a search bar and a list of the
 * most recent places. The FAB (owned by the shell) adds new places.
 */
export class M3HomeScreen extends ScreenElement {
  static override properties = {
    store: { attribute: false },
    focusRequest: { attribute: false },
    selectedId: { attribute: false },
    query: { state: true },
    locateMessage: { state: true },
    locating: { state: true },
  };

  declare focusRequest: MapFocusRequest | null;
  declare selectedId: string | null;
  private declare query: string;
  private declare locateMessage: string;
  private declare locating: boolean;

  constructor() {
    super();
    this.focusRequest = null;
    this.selectedId = null;
    this.query = '';
    this.locateMessage = '';
    this.locating = false;
  }

  private onSearchChange(event: CustomEvent<{ value: string }>): void {
    this.query = event.detail.value;
  }

  private onSearchSubmit(event: CustomEvent<{ value: string }>): void {
    emit(this, 'search-submit', { value: event.detail.value });
  }

  private async centerOnMe(): Promise<void> {
    if (this.locating) return;
    this.locating = true;
    this.locateMessage = 'Getting your location…';
    try {
      const position = await getCurrentPosition();
      this.focusRequest = { lat: position.lat, lng: position.lng, zoom: 13, key: Date.now() };
      this.locateMessage = 'Map centered on your location.';
    } catch (error) {
      this.locateMessage = error instanceof Error ? error.message : 'Could not get your location.';
    } finally {
      this.locating = false;
    }
  }

  private renderList(): TemplateResult {
    const status = this.store.getStatus();
    if (status === 'loading') return renderLoadingState();
    if (status === 'error') {
      return renderErrorState(this.store.getError() ?? 'Could not load your places.', () => {
        void this.store.load();
      });
    }

    const all = this.store.getPlaces();
    if (all.length === 0) {
      return renderEmptyState({
        icon: 'add_location_alt',
        title: 'No places saved yet',
        body: 'Add your first place with the edit button, or click anywhere on the map above.',
        actions: html`<md-filled-button @click=${() => emit(this, 'place-create', {})}>
          <md-icon slot="icon">add</md-icon>
          Add a place
        </md-filled-button>`,
      });
    }

    const filtered = filterPlaces(all, this.query);
    const sorted = sortPlaces(filtered, { key: 'recent' });

    if (sorted.length === 0) {
      return renderEmptyState({
        icon: 'search_off',
        title: 'No places match',
        body: `Nothing in your saved places matches “${this.query.trim()}”.`,
        actions: html`<md-text-button @click=${() => emit(this, 'navigate', { route: 'search' })}>
          Open Search
        </md-text-button>`,
      });
    }

    return html`
      <ul class="place-list">
        ${sorted.map((place) =>
          renderPlaceCard(this, place, { selected: place.id === this.selectedId }),
        )}
      </ul>
    `;
  }

  protected override render(): TemplateResult {
    const count = this.store.getPlaces().length;
    return html`
      <section class="screen" aria-labelledby="home-heading">
        <div class="content__inner">
          <div class="screen__header">
            <h2 class="screen__heading" id="home-heading" tabindex="-1">Home</h2>
            <p class="screen__subheading">
              Your personal map. ${count === 0 ? 'No places saved yet.' : `${count} saved place${count === 1 ? '' : 's'}.`}
              Everything is stored only in this browser.
            </p>
          </div>

          <m3-map
            .places=${this.store.getPlaces()}
            .selectedId=${this.selectedId}
            .focusRequest=${this.focusRequest}
          ></m3-map>

          <div class="home-actions">
            <md-outlined-button ?disabled=${this.locating} @click=${() => this.centerOnMe()}>
              <md-icon slot="icon">my_location</md-icon>
              ${this.locating ? 'Locating…' : 'Center on me'}
            </md-outlined-button>
            <p class="field-hint" role="status" aria-live="polite">
              ${this.locateMessage || 'Click anywhere on the map to add a place there.'}
            </p>
          </div>

          <m3-search-bar
            variant="filled"
            .value=${this.query}
            placeholder="Search"
            label="Filter your saved places"
            @search-change=${(event: CustomEvent<{ value: string }>) => this.onSearchChange(event)}
            @search-submit=${(event: CustomEvent<{ value: string }>) => this.onSearchSubmit(event)}
          ></m3-search-bar>

          ${this.renderList()}
        </div>
      </section>
    `;
  }
}

defineElement('m3-home-screen', M3HomeScreen);
