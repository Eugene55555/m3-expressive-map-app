import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB_NAME, resetConnection } from '../src/data/db.ts';
import { PlaceStore, ValidationError } from '../src/data/store.ts';
import { serializeExport } from '../src/data/exportImport.ts';

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error(`deleteDatabase(${DB_NAME}) blocked: a connection was still open during cleanup`));
  });
}

let store: PlaceStore;

beforeEach(async () => {
  await resetConnection();
  await deleteDatabase();
  store = new PlaceStore();
});

afterEach(async () => {
  await resetConnection();
  await deleteDatabase();
});

describe('PlaceStore', () => {
  it('starts with no places', () => {
    expect(store.getPlaces()).toHaveLength(0);
  });

  it('loads an empty list from storage', async () => {
    await store.load();
    expect(store.getStatus()).toBe('ready');
    expect(store.getPlaces()).toHaveLength(0);
  });

  it('creates a validated place and persists it', async () => {
    const created = await store.create({ name: '  Ridge  ', lat: '10', lng: '20', note: ' n ', favorite: true });
    expect(created.name).toBe('Ridge');
    expect(created.lat).toBe(10);
    expect(created.lng).toBe(20);
    expect(created.note).toBe('n');
    expect(store.getPlaces()).toHaveLength(1);

    const reloaded = new PlaceStore();
    await reloaded.load();
    expect(reloaded.getPlaces()).toHaveLength(1);
  });

  it('rejects invalid input and stores nothing', async () => {
    await expect(store.create({ name: '', lat: '0', lng: '0', note: '', favorite: false })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      store.create({ name: 'x', lat: '999', lng: '0', note: '', favorite: false }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(store.getPlaces()).toHaveLength(0);
  });

  it('updates a place', async () => {
    const created = await store.create({ name: 'A', lat: '1', lng: '2', note: '', favorite: false });
    const updated = await store.update(created.id, {
      name: 'B',
      lat: '3',
      lng: '4',
      note: 'hi',
      favorite: true,
    });
    expect(updated.name).toBe('B');
    expect(updated.favorite).toBe(true);
    expect(store.getById(created.id)?.name).toBe('B');
  });

  it('throws when updating a missing place', async () => {
    await expect(
      store.update('missing', { name: 'A', lat: '1', lng: '2', note: '', favorite: false }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it('removes and restores a place', async () => {
    const created = await store.create({ name: 'A', lat: '1', lng: '2', note: '', favorite: false });
    await store.remove(created.id);
    expect(store.getPlaces()).toHaveLength(0);
    await store.restore(created);
    expect(store.getPlaces()).toHaveLength(1);
  });

  it('toggles favorite', async () => {
    const created = await store.create({ name: 'A', lat: '1', lng: '2', note: '', favorite: false });
    await store.toggleFavorite(created.id);
    expect(store.getById(created.id)?.favorite).toBe(true);
    await store.toggleFavorite(created.id);
    expect(store.getById(created.id)?.favorite).toBe(false);
  });

  it('exports and re-imports its data', async () => {
    await store.create({ name: 'A', lat: '1', lng: '2', note: '', favorite: false });
    const json = store.exportToJson();
    expect(JSON.parse(json).places).toHaveLength(1);

    const summary = store.parseImport(json);
    const result = await store.applyImport(summary);
    expect(result.added).toBe(0);
    expect(result.replaced).toBe(1);
    expect(store.getPlaces()).toHaveLength(1);
  });

  it('imports new places and reports counts', async () => {
    await store.create({ name: 'A', lat: '1', lng: '2', note: '', favorite: false });
    const payload = serializeExport([
      { id: 'new-1', name: 'B', lat: 3, lng: 4, note: '', favorite: false, createdAt: 1, updatedAt: 2 },
      { id: 'new-2', name: 'C', lat: 5, lng: 6, note: '', favorite: false, createdAt: 1, updatedAt: 3 },
    ]);
    const summary = store.parseImport(payload);
    const result = await store.applyImport(summary);
    expect(result.added).toBe(2);
    expect(store.getPlaces()).toHaveLength(3);
  });

  it('clears all data', async () => {
    await store.create({ name: 'A', lat: '1', lng: '2', note: '', favorite: false });
    await store.clearAll();
    expect(store.getPlaces()).toHaveLength(0);
  });

  it('notifies subscribers on change', async () => {
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    await store.create({ name: 'A', lat: '1', lng: '2', note: '', favorite: false });
    unsubscribe();
    expect(calls).toBeGreaterThan(0);
  });
});
