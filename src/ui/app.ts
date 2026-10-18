import { html, type TemplateResult } from 'lit';
import { store, type PlaceStore } from '../data/store.ts';
import type { Place, PlaceFormValues } from '../data/types.ts';
import { LightElement, defineElement } from './base.ts';
import { confirmDialog, notify } from './dialogs.ts';
import { openAboutDialog } from './about-dialog.ts';
import { downloadTextFile, exportFilename } from './download.ts';
import { ROUTES, navigate, onRouteChange, readLocationRoute, type Route } from './router.ts';
import { M3PlaceDetailDialog } from './place-detail-dialog.ts';
import { M3PlaceFormDialog } from './place-form-dialog.ts';
import type { MapFocusRequest } from './map.ts';

interface Destination {
  route: Route;
  icon: string;
  label: string;
}

const DESTINATIONS: Destination[] = [
  { route: 'home', icon: 'home', label: 'Home' },
  { route: 'search', icon: 'search', label: 'Search' },
  { route: 'saved', icon: 'favorite', label: 'Saved' },
  { route: 'settings', icon: 'settings', label: 'Settings' },
];

const SCREEN_IDS: Record<Route, string> = {
  home: 'home-heading',
  search: 'search-heading',
  saved: 'saved-heading',
  settings: 'settings-heading',
};

const RAIL_STORAGE_KEY = 'm3-map-rail-expanded';

/**
 * Application shell. Owns routing, the navigation rail, the top app bar, the
 * FAB and the dialogs. Screens render themselves and communicate through
 * bubbling events handled here.
 */
export class M3App extends LightElement {
  static override properties = {
    route: { state: true },
    railExpanded: { state: true },
    menuOpen: { state: true },
    searchQuery: { state: true },
    focusRequest: { state: true },
    selectedId: { state: true },
  };

  private declare route: Route;
  private declare railExpanded: boolean;
  private declare menuOpen: boolean;
  private declare searchQuery: string;
  private declare focusRequest: MapFocusRequest | null;
  private declare selectedId: string | null;

  readonly store: PlaceStore = store;
  private formDialog: M3PlaceFormDialog | null = null;
  private detailDialog: M3PlaceDetailDialog | null = null;
  private listeners: Array<[string, EventListener]> = [];  private routeUnsubscribe: (() => void) | null = null;
  private firstRoute = true;

  constructor() {
    super();
    this.route = readLocationRoute();
    this.railExpanded = this.readRailPreference();
    this.menuOpen = false;
    this.searchQuery = '';
    this.focusRequest = null;
    this.selectedId = null;
  }

  private readRailPreference(): boolean {
    try {
      return window.localStorage.getItem(RAIL_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeRailPreference(value: boolean): void {
    try {
      window.localStorage.setItem(RAIL_STORAGE_KEY, value ? 'true' : 'false');
    } catch {
      /* storage may be unavailable; the toggle still works for this session */
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.bindEvents();
    this.routeUnsubscribe = onRouteChange((route) => this.applyRoute(route, true));
    void this.store.load();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const [type, handler] of this.listeners) this.removeEventListener(type, handler);
    this.listeners = [];
    this.routeUnsubscribe?.();
    this.routeUnsubscribe = null;
    this.formDialog?.remove();
    this.detailDialog?.remove();
  }

  private bindEvents(): void {
    this.on('navigate', (event) => {
      const detail = (event as CustomEvent<{ route: Route }>).detail;
      navigate(detail.route);
    });
    this.on('place-create', () => {
      void this.openCreate();
    });
    this.on('place-pick', (event) => {
      const detail = (event as CustomEvent<{ lat: number; lng: number }>).detail;
      void this.openCreate({ lat: detail.lat, lng: detail.lng });
    });
    this.on('place-edit', (event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      void this.openEdit(detail.id);
    });
    this.on('place-delete', (event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      void this.deletePlace(detail.id);
    });
    this.on('place-view', (event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      void this.openDetail(detail.id);
    });
    this.on('place-show-on-map', (event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      this.showOnMap(detail.id);
    });
    this.on('place-toggle-favorite', (event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      void this.toggleFavorite(detail.id);
    });
    this.on('search-submit', (event) => {
      const detail = (event as CustomEvent<{ value: string }>).detail;
      this.searchQuery = detail.value;
      this.searchScreen()?.setQuery(detail.value);
      navigate('search');
    });
    this.on('app-notify', (event) => {
      const detail = (event as CustomEvent<{ message: string }>).detail;
      notify(detail.message);
    });
    this.on('speech-unavailable', () => {
      notify('Voice search is not supported in this browser.');
    });
  }

  private on(type: string, handler: (event: Event) => void): void {
    const listener = handler as EventListener;
    this.addEventListener(type, listener);
    this.listeners.push([type, listener]);
  }

  private searchScreen(): (HTMLElement & { setQuery(value: string): void }) | null {
    return this.querySelector('m3-search-screen');
  }

  private applyRoute(route: Route, animate: boolean): void {
    const previous = this.route;
    const forward =
      ROUTES.indexOf(route) >= ROUTES.indexOf(previous) && previous !== route;
    this.route = route;

    if (!animate) return;
    void this.updateComplete.then(() => {
      const screen = this.querySelector<HTMLElement>(`.screen[data-route="${route}"]`);
      if (screen) {
        screen.setAttribute('data-anim', forward ? 'forward' : 'back');
        window.setTimeout(() => screen.removeAttribute('data-anim'), 420);
      }
      if (!this.firstRoute) {
        const heading = this.querySelector<HTMLElement>(`#${SCREEN_IDS[route]}`);
        heading?.focus({ preventScroll: true });
      }
      this.firstRoute = false;
    });
  }

  private toggleRail(): void {
    this.railExpanded = !this.railExpanded;
    this.writeRailPreference(this.railExpanded);
    void this.updateComplete.then(() =>
      this.querySelector<HTMLElement & { invalidate(): void }>('m3-map')?.invalidate(),
    );
  }

  private getFormDialog(): M3PlaceFormDialog {
    if (!this.formDialog || !this.formDialog.isConnected) {
      this.formDialog = document.createElement('m3-place-form-dialog') as M3PlaceFormDialog;
      document.body.append(this.formDialog);
    }
    return this.formDialog;
  }

  private getDetailDialog(): M3PlaceDetailDialog {
    if (!this.detailDialog || !this.detailDialog.isConnected) {
      this.detailDialog = document.createElement('m3-place-detail-dialog') as M3PlaceDetailDialog;
      document.body.append(this.detailDialog);
    }
    return this.detailDialog;
  }

  async openCreate(prefill?: { lat: number; lng: number }): Promise<void> {
    const saved = await this.getFormDialog().open({
      mode: 'create',
      prefill: prefill ?? null,
      onSubmit: async (values: PlaceFormValues) => {
        const place = await this.store.create(values);
        notify(`Saved “${place.name}”.`);
      },
    });
    if (saved) navigate('saved');
  }

  async openEdit(id: string): Promise<void> {
    const place = this.store.getById(id);
    if (!place) {
      notify('That place no longer exists.');
      return;
    }
    await this.getFormDialog().open({
      mode: 'edit',
      initial: place,
      onSubmit: async (values: PlaceFormValues) => {
        await this.store.update(id, values);
        notify('Place updated.');
      },
    });
  }

  async openDetail(id: string): Promise<void> {
    const place = this.store.getById(id);
    if (!place) {
      notify('That place no longer exists.');
      return;
    }
    const action = await this.getDetailDialog().open(place);
    if (action === 'edit') await this.openEdit(id);
    else if (action === 'delete') await this.deletePlace(id);
    else if (action === 'show-on-map') this.showOnMap(id);
  }

  async deletePlace(id: string): Promise<void> {
    const place = this.store.getById(id);
    if (!place) return;
    const confirmed = await confirmDialog({
      headline: `Delete “${place.name}”?`,
      body: 'This removes the place from this browser. You can undo right after deleting.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await this.store.remove(id);
      notify('Place deleted.', 'Undo', () => {
        void this.restoreForUndo(place);
      });
    } catch (error) {
      notify(this.errorMessage(error, 'Could not delete the place.'));
    }
  }

  private async restoreForUndo(place: Place): Promise<void> {
    try {
      await this.store.restore(place);
    } catch (error) {
      notify(this.errorMessage(error, 'Could not undo the delete.'));
    }
  }

  private async toggleFavorite(id: string): Promise<void> {
    const place = this.store.getById(id);
    try {
      await this.store.toggleFavorite(id);
      notify(place?.favorite ? 'Removed from favorites.' : 'Added to favorites.');
    } catch (error) {
      notify(this.errorMessage(error, 'Could not update the favorite.'));
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private showOnMap(id: string): void {
    const place = this.store.getById(id);
    if (!place) return;
    this.selectedId = place.id;
    this.focusRequest = { lat: place.lat, lng: place.lng, zoom: 13, key: Date.now() };
    navigate('home');
    notify(`Showing “${place.name}” on the map.`);
  }

  private exportFromMenu(): void {
    const places = this.store.getPlaces();
    if (places.length === 0) {
      notify('There is nothing to export yet.');
      return;
    }
    try {
      const json = this.store.exportToJson();
      downloadTextFile(exportFilename(), json);
      notify(`Exported ${places.length} place${places.length === 1 ? '' : 's'}.`);
    } catch (error) {
      notify(this.errorMessage(error, 'Could not export your places.'));
    }
  }

  private renderDestinations(className: string, iconWrap: string): TemplateResult {
    return html`
      <ul class=${className}>
        ${DESTINATIONS.map(
          (destination) => html`
            <li>
              <button
                type="button"
                class=${className === 'rail__destinations' ? 'rail-item' : 'bottom-nav__item'}
                aria-current=${this.route === destination.route ? 'page' : 'false'}
                @click=${() => navigate(destination.route)}
              >
                <md-ripple aria-hidden="true"></md-ripple>
                <span class=${iconWrap}>
                  <md-icon aria-hidden="true">${destination.icon}</md-icon>
                </span>
                <span>${destination.label}</span>
              </button>
            </li>
          `,
        )}
      </ul>
    `;
  }

  protected override render(): TemplateResult {
    const railState = this.railExpanded ? 'expanded' : 'collapsed';
    return html`
      <a class="skip-link" href="#main-content">Skip to content</a>
      <div class="app-shell" data-rail=${railState}>
        <nav class="rail" aria-label="Primary">
          <div class="rail__brand">
            <span class="rail__brand-mark" aria-hidden="true">SP</span>
            ${this.railExpanded ? html`<span class="rail__brand-name">Saved Places</span>` : ''}
          </div>
          ${this.renderDestinations('rail__destinations', 'rail-item__icon-wrap')}
        </nav>

        <div class="app-main">
          <header class="top-bar">
            <md-icon-button
              class="top-bar__menu-toggle"
              aria-label=${this.railExpanded ? 'Collapse navigation' : 'Expand navigation'}
              aria-expanded=${this.railExpanded ? 'true' : 'false'}
              @click=${() => this.toggleRail()}
            >
              <md-icon>menu</md-icon>
            </md-icon-button>
            <h1 class="top-bar__title">Saved Places</h1>
            <md-icon-button id="app-more-button" aria-label="More options" @click=${() => (this.menuOpen = !this.menuOpen)}>
              <md-icon>more_vert</md-icon>
            </md-icon-button>
            <md-menu
              positioning="fixed"
              anchor="app-more-button"
              .open=${this.menuOpen}
              @closed=${() => (this.menuOpen = false)}
            >
              <md-menu-item @click=${() => this.exportFromMenu()}>
                <md-icon slot="start">download</md-icon>
                <div slot="headline">Export JSON</div>
              </md-menu-item>
              <md-menu-item @click=${() => navigate('settings')}>
                <md-icon slot="start">settings</md-icon>
                <div slot="headline">Go to Settings</div>
              </md-menu-item>
              <md-menu-item @click=${() => openAboutDialog()}>
                <md-icon slot="start">info</md-icon>
                <div slot="headline">About &amp; privacy</div>
              </md-menu-item>
            </md-menu>
          </header>

          <main class="content" id="main-content" tabindex="-1">
            <m3-home-screen
              class="screen"
              data-route="home"
              .store=${this.store}
              .focusRequest=${this.focusRequest}
              .selectedId=${this.selectedId}
              ?hidden=${this.route !== 'home'}
            ></m3-home-screen>
            <m3-search-screen
              class="screen"
              data-route="search"
              .store=${this.store}
              ?hidden=${this.route !== 'search'}
            ></m3-search-screen>
            <m3-saved-screen
              class="screen"
              data-route="saved"
              .store=${this.store}
              ?hidden=${this.route !== 'saved'}
            ></m3-saved-screen>
            <m3-settings-screen
              class="screen"
              data-route="settings"
              .store=${this.store}
              ?hidden=${this.route !== 'settings'}
            ></m3-settings-screen>
          </main>

          <nav class="bottom-nav" aria-label="Primary">
            ${this.renderDestinations('bottom-nav__list', 'bottom-nav__icon-wrap')}
          </nav>

          ${this.route !== 'settings'
            ? html`
                <md-fab
                  class="app-fab"
                  aria-label="Add a new place"
                  @click=${() => this.openCreate()}
                >
                  <md-icon slot="icon">edit</md-icon>
                </md-fab>
              `
            : ''}
        </div>
      </div>
    `;
  }
}

defineElement('m3-app', M3App);
