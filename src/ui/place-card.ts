import { html, nothing, type TemplateResult } from 'lit';
import type { Place } from '../data/types.ts';
import { emit } from './events.ts';
import { formatCoordLabel, formatLatLng, formatRelative } from './format.ts';

export interface PlaceCardOptions {
  selected?: boolean;
  showRelativeTime?: boolean;
}

/**
 * One saved place, as a card. All actions emit events that the shell handles,
 * so the card stays a pure presentation component.
 */
export function renderPlaceCard(
  host: EventTarget,
  place: Place,
  options: PlaceCardOptions = {},
): TemplateResult {
  return html`
    <li class="place-card" data-selected=${options.selected ? 'true' : 'false'} data-id=${place.id}>
      <div class="place-card__head">
        <h3 class="place-card__title">
          <button
            type="button"
            class="link-button"
            @click=${() => emit(host, 'place-view', { id: place.id })}
          >
            <md-ripple aria-hidden="true"></md-ripple>
            ${place.name}
          </button>
        </h3>
        <md-icon-button
          class="place-card__favorite"
          .selected=${place.favorite}
          aria-label=${place.favorite ? `Remove ${place.name} from favorites` : `Add ${place.name} to favorites`}
          @click=${() => emit(host, 'place-toggle-favorite', { id: place.id })}
        >
          <md-icon>${place.favorite ? 'star' : 'star_border'}</md-icon>
        </md-icon-button>
      </div>

      <p class="place-card__meta">
        <md-icon aria-hidden="true">location_on</md-icon>
        <span class="place-card__coords" title=${formatLatLng(place.lat, place.lng)}>
          ${formatCoordLabel(place.lat, place.lng)}
        </span>
      </p>

      ${place.note ? html`<p class="place-card__note">${place.note}</p>` : nothing}

      <p class="place-card__meta">
        <md-icon aria-hidden="true">schedule</md-icon>
        <span>Updated ${formatRelative(place.updatedAt)}</span>
      </p>

      <div class="place-card__actions">
        <md-icon-button
          aria-label="Show ${place.name} on the map"
          @click=${() => emit(host, 'place-show-on-map', { id: place.id })}
        >
          <md-icon>map</md-icon>
        </md-icon-button>
        <md-icon-button
          aria-label="Edit ${place.name}"
          @click=${() => emit(host, 'place-edit', { id: place.id })}
        >
          <md-icon>edit</md-icon>
        </md-icon-button>
        <md-icon-button
          aria-label="Delete ${place.name}"
          @click=${() => emit(host, 'place-delete', { id: place.id })}
        >
          <md-icon>delete</md-icon>
        </md-icon-button>
      </div>
    </li>
  `;
}
