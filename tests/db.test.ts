import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DB_NAME,
  clearPlaces,
  deletePlace,
  listPlaces,
  putPlace,
  putManyPlaces,
  resetConnection,
} from '../src/data/db.ts';
import type { Place } from '../src/data/types.ts';

function makePlace(id: string, updatedAt: number): Place {
  return { id, name: `Place ${id}`, lat: 0, lng: 0, note: '', favorite: false, createdAt: 0, updatedAt };
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error(`deleteDatabase(${DB_NAME}) blocked: a connection was still open during cleanup`));
  });
}

beforeEach(async () => {
  await resetConnection();
  await deleteDatabase();
});

afterEach(async () => {
  await resetConnection();
  await deleteDatabase();
});

describe('places storage', () => {
  it('starts empty (no seeded data)', async () => {
    await expect(listPlaces()).resolves.toEqual([]);
  });

  it('round-trips a single place', async () => {
    await putPlace(makePlace('a', 1));
    const places = await listPlaces();
    expect(places).toHaveLength(1);
    expect(places[0].id).toBe('a');
  });

  it('lists places newest first', async () => {
    await putPlace(makePlace('a', 1));
    await putPlace(makePlace('b', 5));
    await putPlace(makePlace('c', 3));
    expect((await listPlaces()).map((place) => place.id)).toEqual(['b', 'c', 'a']);
  });

  it('updates an existing place by id', async () => {
    await putPlace(makePlace('a', 1));
    await putPlace({ ...makePlace('a', 9), name: 'Renamed' });
    const places = await listPlaces();
    expect(places).toHaveLength(1);
    expect(places[0].name).toBe('Renamed');
  });

  it('deletes a place', async () => {
    await putPlace(makePlace('a', 1));
    await deletePlace('a');
    await expect(listPlaces()).resolves.toEqual([]);
  });

  it('clears everything', async () => {
    await putManyPlaces([makePlace('a', 1), makePlace('b', 2)]);
    await clearPlaces();
    await expect(listPlaces()).resolves.toEqual([]);
  });

  it('resetConnection closes the connection so deletion is not blocked', async () => {
    await putPlace(makePlace('a', 1));
    await resetConnection();
    await expect(deleteDatabase()).resolves.toBeUndefined();
  });

  it('reopens freshly after a reset between connection close and deletion', async () => {
    await putPlace(makePlace('a', 1));
    await resetConnection();
    await deleteDatabase();
    await expect(listPlaces()).resolves.toEqual([]);
  });
});
