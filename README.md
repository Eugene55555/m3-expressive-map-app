# M3 Expressive Map App

A personal, local-first map of the places you save. Built with Material 3
Expressive (Material Web `@material/web`), Lit, and Leaflet. Everything runs
in the browser and every record stays in your browser.

## Features

- Interactive Leaflet map with OpenStreetMap tiles — no API key required;
  tap the map to pick coordinates for a new place.
- Save, edit, and delete places with a name, coordinates, note, and favorite
  flag, validated in the browser.
- Sort your saved places by recency or name; live search across names and
  notes.
- Voice input for place names where the browser supports the non-standard
  Web Speech API; the UI degrades gracefully when it does not.
- JSON export and import so you can move your data between browsers or
  devices yourself.
- Local-only persistence via IndexedDB (`m3-expressive-map-app` → `places`).
  There are **no demo records, no accounts, no analytics, and no backend** —
  saved-place records are not transmitted by the app: map tile requests
  send your viewport and network metadata to OpenStreetMap, and optional
  speech audio may be processed remotely depending on the browser and
  provider (detail in the privacy notes below).

## Privacy notes

- **Storage:** all places live only in your browser's IndexedDB. Clearing
  site data deletes them permanently; there is no server copy.
- **Map tiles:** map tiles are fetched from OpenStreetMap over the network,
  so those requests expose your approximate viewport and network metadata to
  OpenStreetMap servers.
- **Speech recognition:** voice input uses the browser's built-in Web Speech
  API. How the audio is handled depends on the browser and provider: some
  process it on-device, while others (Chrome, for example) send it to the
  browser vendor's speech service. If your browser delegates recognition to
  a remote service, the audio is not limited to your device; decide
  accordingly before using it. Where the API is unavailable, it is simply
  disabled.
- Leaflet and OpenStreetMap attribution is shown on the map and in the About
  dialog; OpenStreetMap data is © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

## Setup

```bash
npm ci             # reproducible install from package-lock.json
npm run dev        # local dev server
```

## Checks and build

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest run
npm run build      # typecheck + vite production build to dist/
npm run build:docs # build, then copy dist/ to docs/ for GitHub Pages
```

## GitHub Pages

The production site is published at:

<https://eugene55555.github.io/m3-expressive-map-app/>

The Vite `base` is set to `/m3-expressive-map-app/` so that the built assets
resolve correctly under the Pages subpath. `npm run build:docs` produces a
static `docs/` tree (with `docs/.nojekyll`, and no source maps, secrets, or
server dependencies) that Pages can serve directly. Map tiles still load
from OpenStreetMap at runtime, as described above.
