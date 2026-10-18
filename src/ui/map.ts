import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { html } from 'lit';
import type { Place } from '../data/types.ts';
import { LightElement, defineElement } from './base.ts';
import { formatLatLng } from './format.ts';

export type MapStatus = 'loading' | 'ready' | 'error';

export interface MapFocusRequest {
  lat: number;
  lng: number;
  zoom?: number;
  key: number;
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const WORLD_CENTER: L.LatLngExpression = [20, 0];
const WORLD_ZOOM = 2;
const LOAD_TIMEOUT_MS = 15_000;
const MAX_TILE_ERRORS = 6;

/**
 * Tooltip content as a DOM element with textContent: place names come from
 * untrusted user input, and Leaflet treats string content as HTML.
 */
export function tooltipContent(name: string): HTMLElement {
  const el = document.createElement('span');
  el.textContent = name;
  return el;
}

/**
 * Real, interactive Leaflet map with OpenStreetMap tiles. No API key, no
 * initial markers, an honest loading state and a retryable error state.
 */
export class M3MapThumb extends LightElement {
  static override properties = {
    places: { attribute: false },
    selectedId: { attribute: false },
    focusRequest: { attribute: false },
    compact: { type: Boolean, reflect: true },
    _status: { state: true },
    _errorDetail: { state: true },
  };

  declare places: readonly Place[];
  declare selectedId: string | null;
  declare focusRequest: MapFocusRequest | null;
  declare compact: boolean;
  private _status!: MapStatus;
  private _errorDetail!: string;

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private readonly markers = new Map<string, L.CircleMarker>();
  private resizeObserver: ResizeObserver | null = null;
  private loadTimer: number | null = null;
  private tileErrors = 0;

  constructor() {
    super();
    this.places = [];
    this.selectedId = null;
    this.focusRequest = null;
    this.compact = false;
    this._status = 'loading';
    this._errorDetail = '';
  }

  /** Public: force Leaflet to re-measure (e.g. after the rail resizes). */
  invalidate(): void {
    this.map?.invalidateSize();
  }

  protected override firstUpdated(): void {
    this.initMap();
    this.syncMarkers();
    this.applyFocus();
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (changed.has('places') || changed.has('selectedId')) {
      this.initMap();
      this.syncMarkers();
    }
    if (changed.has('focusRequest')) {
      this.applyFocus();
    }
    if (changed.has('compact')) {
      this.map?.invalidateSize();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyMap();
  }

  private setStatus(status: MapStatus, detail = ''): void {
    this._status = status;
    this._errorDetail = detail;
  }

  private initMap(): void {
    if (this.map) return;
    const canvas = this.querySelector<HTMLElement>('.map-card__canvas');
    if (!canvas) return;

    const map = L.map(canvas, {
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      minZoom: 1,
      maxZoom: 19,
      zoomControl: true,
      worldCopyJump: true,
      attributionControl: true,
      keyboard: true,
    });
    this.map = map;

    map.on('click', (event: L.LeafletMouseEvent) => {
      this.dispatchEvent(
        new CustomEvent('place-pick', {
          detail: { lat: event.latlng.lat, lng: event.latlng.lng },
          bubbles: true,
          composed: true,
        }),
      );
    });

    this.attachTiles();

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this);
  }

  private attachTiles(): void {
    const map = this.map;
    if (!map) return;
    this.tileErrors = 0;

    if (this.tileLayer) {
      this.tileLayer.remove();
      this.tileLayer = null;
    }

    const layer = L.tileLayer(OSM_URL, {
      maxZoom: 19,
      attribution: OSM_ATTRIBUTION,
      crossOrigin: true,
    });
    this.tileLayer = layer;

    layer.on('load', () => {
      this.clearLoadTimer();
      this.setStatus('ready');
    });
    layer.on('tileerror', () => {
      this.tileErrors += 1;
      if (this._status !== 'ready' && this.tileErrors >= MAX_TILE_ERRORS) {
        this.setStatus('error', 'Map tiles could not be loaded. Check your connection and retry.');
      }
    });

    layer.addTo(map);
    this.setStatus('loading');
    this.loadTimer = window.setTimeout(() => {
      if (this._status === 'loading') {
        this.setStatus('error', 'The map is taking too long to load. Check your connection and retry.');
      }
    }, LOAD_TIMEOUT_MS);
  }

  private clearLoadTimer(): void {
    if (this.loadTimer !== null) {
      window.clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
  }

  retry(): void {
    this.clearLoadTimer();
    this.tileErrors = 0;
    this.attachTiles();
  }

  private syncMarkers(): void {
    const map = this.map;
    if (!map) return;

    const wanted = new Set(this.places.map((place) => place.id));
    for (const [id, marker] of this.markers) {
      if (!wanted.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }

    for (const place of this.places) {
      const existing = this.markers.get(place.id);
      if (existing) {
        existing.setLatLng([place.lat, place.lng]);
        this.styleMarker(existing, place.id === this.selectedId);
        existing.setTooltipContent(tooltipContent(place.name));
      } else {
        const marker = L.circleMarker([place.lat, place.lng], {
          radius: 7,
          color: this.cssVar('--md-sys-color-on-primary-container'),
          weight: 2,
          fillColor: this.cssVar('--md-sys-color-primary'),
          fillOpacity: 0.9,
          bubblingMouseEvents: false,
        });
        marker.bindTooltip(tooltipContent(place.name), { direction: 'top', offset: [0, -6] });
        marker.on('click', () => {
          this.dispatchEvent(
            new CustomEvent('place-view', {
              detail: { id: place.id },
              bubbles: true,
              composed: true,
            }),
          );
        });
        marker.addTo(map);
        this.markers.set(place.id, marker);
      }
    }
  }

  private styleMarker(marker: L.CircleMarker, selected: boolean): void {
    marker.setStyle({
      radius: selected ? 10 : 7,
      weight: selected ? 3 : 2,
      fillColor: selected
        ? this.cssVar('--md-sys-color-tertiary')
        : this.cssVar('--md-sys-color-primary'),
      color: selected
        ? this.cssVar('--md-sys-color-on-tertiary-container')
        : this.cssVar('--md-sys-color-on-primary-container'),
    });
    if (selected) marker.bringToFront();
  }

  private cssVar(name: string): string {
    return getComputedStyle(this).getPropertyValue(name).trim();
  }

  private applyFocus(): void {
    const request = this.focusRequest;
    const map = this.map;
    if (!request || !map) return;
    map.flyTo([request.lat, request.lng], request.zoom ?? 14, { duration: 0.6 });
  }

  private destroyMap(): void {
    this.clearLoadTimer();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.markers.clear();
    this.map?.remove();
    this.map = null;
    this.tileLayer = null;
  }

  protected override render() {
    return html`
      <div class="map-card" data-status=${this._status}>
        <div
          class="map-card__canvas"
          role="region"
          aria-label="Interactive map of your saved places"
        ></div>
        <div class="map-card__loading" role="status">
          <md-icon aria-hidden="true">map</md-icon>
          <span>Loading map…</span>
        </div>
        <div class="map-card__error" role="alert">
          <p class="map-card__error-text">The map could not be displayed.</p>
          <p class="map-card__error-detail">${this._errorDetail || 'Something went wrong while loading tiles.'}</p>
          <md-text-button @click=${() => this.retry()}>
            <md-icon slot="icon">refresh</md-icon>
            Retry
          </md-text-button>
        </div>
        <p class="map-card__attribution">
          &copy;
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
            >OpenStreetMap</a
          >
          contributors
        </p>
      </div>
    `;
  }
}

defineElement('m3-map', M3MapThumb);

/** Exposed for tests: describe a place marker position. */
export function markerSummary(place: Place): string {
  return `${place.name} @ ${formatLatLng(place.lat, place.lng)}`;
}
