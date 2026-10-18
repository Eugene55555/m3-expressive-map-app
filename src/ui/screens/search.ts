import { html, type TemplateResult } from 'lit';
import { filterPlaces, sortPlaces } from '../../data/search.ts';
import { defineElement } from '../base.ts';
import { ScreenElement } from '../screen.ts';
import { renderPlaceCard } from '../place-card.ts';
import { renderEmptyState, renderErrorState, renderLoadingState } from '../states.ts';

/** Search: local, private full-text search over the user's saved places. */
export class M3SearchScreen extends ScreenElement {
  static override properties = {
    store: { attribute: false },
    query: { state: true },
  };

  private declare query: string;

  constructor() {
    super();
    this.query = '';
  }

  /** Called by the shell when navigating in with a query (e.g. from Home). */
  setQuery(value: string): void {
    this.query = value;
  }

  private renderResults(): TemplateResult {
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
        icon: 'bookmark_border',
        title: 'Nothing to search yet',
        body: 'You have not saved any places. Add one and it will appear here instantly.',
        actions: html`<md-filled-button @click=${() => this.dispatchEvent(new CustomEvent('place-create', { detail: {}, bubbles: true, composed: true }))}>
          <md-icon slot="icon">add</md-icon>
          Add a place
        </md-filled-button>`,
      });
    }

    const trimmed = this.query.trim();
    if (trimmed.length === 0) {
      return renderEmptyState({
        icon: 'search',
        title: 'Search your saved places',
        body: 'Type a name, a note or coordinates. Search runs entirely in your browser.',
      });
    }

    const results = sortPlaces(filterPlaces(all, trimmed), { key: 'recent' });
    if (results.length === 0) {
      return renderEmptyState({
        icon: 'search_off',
        title: 'No places match',
        body: `No saved place matches “${trimmed}”. Try a different name or note.`,
        actions: html`<md-text-button @click=${() => this.setQuery('')}>Clear search</md-text-button>`,
      });
    }

    return html`
      <p class="result-count" role="status" aria-live="polite">
        ${results.length} result${results.length === 1 ? '' : 's'} for “${trimmed}”
      </p>
      <ul class="place-list">
        ${results.map((place) => renderPlaceCard(this, place))}
      </ul>
    `;
  }

  protected override render(): TemplateResult {
    return html`
      <section class="screen" aria-labelledby="search-heading">
        <div class="content__inner">
          <div class="screen__header">
            <h2 class="screen__heading" id="search-heading" tabindex="-1">Search</h2>
            <p class="screen__subheading">
              Find a place by name, note or coordinates. Typed searches are processed locally in your browser; saved-place records and their exact stored coordinates stay on your device. Map tiles come from OpenStreetMap, so requests disclose your approximate viewport — which can reveal an approximate current or saved location — along with network metadata. Voice recognition may process audio remotely, depending on your browser and its provider.
            </p>
          </div>

          <m3-search-bar
            variant="filled"
            .value=${this.query}
            placeholder="Search"
            label="Search your saved places"
            @search-change=${(event: CustomEvent<{ value: string }>) => {
              this.query = event.detail.value;
            }}
          ></m3-search-bar>

          ${this.renderResults()}
        </div>
      </section>
    `;
  }
}

defineElement('m3-search-screen', M3SearchScreen);
