import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const confirmDialog = vi.hoisted(() => vi.fn<(options: unknown) => Promise<boolean>>());

vi.mock('../src/ui/dialogs.ts', () => ({
  confirmDialog,
  notify: vi.fn(),
}));

import { M3SettingsScreen } from '../src/ui/screens/settings.ts';
import { parseImportJson, serializeExport } from '../src/data/exportImport.ts';
import type { PlaceStore } from '../src/data/store.ts';
import type { Place } from '../src/data/types.ts';

type TestPlace = Place;

function makeStore(initial: TestPlace[]): PlaceStore & { applied: number } {
  const state = {
    places: [...initial],
    applied: 0,
  };
  return {
    get applied() {
      return state.applied;
    },
    getPlaces() {
      return state.places;
    },
    parseImport(text: string) {
      return parseImportJson(text);
    },
    async applyImport(summary: { places: TestPlace[] }) {
      state.applied += 1;
      const byId = new Map(state.places.map((place) => [place.id, place] as const));
      for (const place of summary.places) byId.set(place.id, place);
      state.places = [...byId.values()];
      return { added: 0, replaced: summary.places.length, skipped: 0, errors: [] };
    },
    exportToJson() {
      return serializeExport(state.places);
    },
  } as unknown as PlaceStore & { applied: number };
}

function makeElement(store: PlaceStore): M3SettingsScreen {
  const element = new M3SettingsScreen();
  (element as unknown as { store: PlaceStore }).store = store;
  return element;
}

async function chooseFile(element: M3SettingsScreen, text: string): Promise<void> {
  const file = new File([text], 'places.json', { type: 'application/json' });
  const event = { target: { files: [file], value: '' } } as unknown as Event;
  await (element as unknown as { onFileChosen: (event: Event) => Promise<void> }).onFileChosen(event);
}

describe('import collision handling', () => {
  beforeEach(() => {
    confirmDialog.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('asks once with an explicit count and does not import when canceled', async () => {
    const store = makeStore([
      { id: 'a-1', name: 'A', lat: 1, lng: 2, note: '', favorite: false, createdAt: 1, updatedAt: 2 },
    ]);
    const element = makeElement(store);
    confirmDialog.mockResolvedValue(false);

    await chooseFile(
      element,
      serializeExport([
        { id: 'a-1', name: 'Overwritten', lat: 9, lng: 9, note: '', favorite: true, createdAt: 1, updatedAt: 2 },
        { id: 'b-1', name: 'New', lat: 3, lng: 4, note: '', favorite: false, createdAt: 1, updatedAt: 2 },
      ]),
    );

    expect(confirmDialog).toHaveBeenCalledTimes(1);
    const options = confirmDialog.mock.calls[0][0] as {
      headline: string;
      body: string;
      confirmLabel: string;
      cancelLabel: string;
    };
    expect(options.confirmLabel).toBe('Replace and import');
    expect(options.cancelLabel).toBe('Cancel import');
    expect(options.body).toContain('1 of the 2');

    expect(store.applied).toBe(0);
    expect(store.getPlaces()[0]?.name).toBe('A');
    const screen = element as unknown as { status: string; statusTone: string };
    expect(screen.status).toMatch(/canceled/i);
    expect(screen.statusTone).toBe('info');
  });

  it('imports after confirmation', async () => {
    const store = makeStore([
      { id: 'a-1', name: 'A', lat: 1, lng: 2, note: '', favorite: false, createdAt: 1, updatedAt: 2 },
    ]);
    const element = makeElement(store);
    confirmDialog.mockResolvedValue(true);

    await chooseFile(
      element,
      serializeExport([
        { id: 'a-1', name: 'Overwritten', lat: 9, lng: 9, note: '', favorite: true, createdAt: 1, updatedAt: 2 },
      ]),
    );

    expect(confirmDialog).toHaveBeenCalledTimes(1);
    expect(store.applied).toBe(1);
    const screen = element as unknown as { status: string; statusTone: string };
    expect(screen.statusTone).toBe('success');
  });

  it('skips the dialog when no imported id already exists', async () => {
    const store = makeStore([]);
    const element = makeElement(store);

    await chooseFile(
      element,
      serializeExport([
        { id: 'new-1', name: 'B', lat: 3, lng: 4, note: '', favorite: false, createdAt: 1, updatedAt: 2 },
      ]),
    );

    expect(confirmDialog).not.toHaveBeenCalled();
    expect(store.applied).toBe(1);
  });
});
