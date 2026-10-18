import { html, type TemplateResult } from 'lit';
import { sortPlaces } from '../../data/search.ts';
import type { SortKey } from '../../data/types.ts';
import { defineElement } from '../base.ts';
import { emit } from '../events.ts';
import { ScreenElement } from '../screen.ts';
import { renderPlaceCard } from '../place-card.ts';
import { renderEmptyState, renderErrorState, renderLoadingState } from '../states.ts';

/** Saved: the complete list of saved places with sorting and a favorites filter. */
export class M3SavedScreen extends ScreenElement {
  static override properties = {
    store: { attribute: false },
    sortKey: { state: true },
    favoritesOnly: { state: true },
  };

  private declare sortKey: SortKey;
  private declare favoritesOnly: boolean;

  constructor() {
    super();
    this.sortKey = 'recent';
    this.favoritesOnly = false;
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
        icon: 'bookmark_border',
        title: 'Nothing saved yet',
        body: 'Places you add are listed here. Use the edit button to add your first place.',
        actions: html`<md-filled-button @click=${() => emit(this, 'place-create', {})}>
          <md-icon slot="icon">add</md-icon>
          Add a place
        </md-filled-button>`,
      });
    }

    const filtered = this.favoritesOnly ? all.filter((place) => place.favorite) : [...all];
    if (filtered.length === 0) {
      return renderEmptyState({
        icon: 'star_border',
        title: 'No favorites yet',
        body: 'Star a place to keep it here for quick access.',
        actions: html`<md-text-button @click=${() => (this.favoritesOnly = false)}>
          Show all places
        </md-text-button>`,
      });
    }

    const sorted = sortPlaces(filtered, { key: this.sortKey });
    return html`
      <p class="result-count" role="status" aria-live="polite">
        ${sorted.length} place${sorted.length === 1 ? '' : 's'}${this.favoritesOnly ? ' (favorites)' : ''}
      </p>
      <ul class="place-list">
        ${sorted.map((place) => renderPlaceCard(this, place))}
      </ul>
    `;
  }

  protected override render(): TemplateResult {
    const count = this.store.getPlaces().length;
    return html`
      <section class="screen" aria-labelledby="saved-heading">
        <div class="content__inner">
          <div class="screen__header">
            <h2 class="screen__heading" id="saved-heading" tabindex="-1">Saved</h2>
            <p class="screen__subheading">
              ${count === 0 ? 'No saved places.' : `All ${count} place${count === 1 ? '' : 's'} you have saved.`}
            </p>
          </div>

          ${count > 0
            ? html`
                <div class="screen-toolbar">
                  <md-filter-chip
                    label="Favorites"
                    .selected=${this.favoritesOnly}
                    @change=${() => (this.favoritesOnly = !this.favoritesOnly)}
                  >
                    <md-icon slot="icon">star</md-icon>
                    Favorites
                  </md-filter-chip>
                  <md-outlined-select
                    label="Sort by"
                    .value=${this.sortKey}
                    @change=${(event: Event) => {
                      this.sortKey = (event.target as HTMLElement & { value: SortKey }).value;
                    }}
                  >
                    <md-select-option value="recent">
                      <div slot="headline">Recently updated</div>
                    </md-select-option>
                    <md-select-option value="name">
                      <div slot="headline">Name (A–Z)</div>
                    </md-select-option>
                  </md-outlined-select>
                </div>
              `
            : ''}

          ${this.renderList()}
        </div>
      </section>
    `;
  }
}

defineElement('m3-saved-screen', M3SavedScreen);
