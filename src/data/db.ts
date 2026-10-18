import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Place } from './types.ts';

export const DB_NAME = 'm3-expressive-map-app';
export const DB_VERSION = 1;
export const STORE_NAME = 'places';

interface PlacesDB extends DBSchema {
  places: {
    key: string;
    value: Place;
    indexes: { 'by-updated': number };
  };
}

let dbPromise: Promise<IDBPDatabase<PlacesDB>> | null = null;

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'StorageError';
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

function open(): Promise<IDBPDatabase<PlacesDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PlacesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by-updated', 'updatedAt');
        }
      },
    }).catch((error: unknown) => {
      dbPromise = null;
      throw new StorageError('Could not open local storage (IndexedDB).', { cause: error });
    });
  }
  return dbPromise;
}

function isPlace(value: unknown): value is Place {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.lat === 'number' &&
    typeof record.lng === 'number' &&
    typeof record.note === 'string' &&
    typeof record.favorite === 'boolean' &&
    typeof record.createdAt === 'number' &&
    typeof record.updatedAt === 'number'
  );
}

function wrapError(action: string, error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  return new StorageError(`Could not ${action}. Your browser may be blocking local storage.`, { cause: error });
}

export interface StorageInfo {
  supported: boolean;
  readonly: boolean;
}

export async function storageInfo(): Promise<StorageInfo> {
  if (typeof indexedDB === 'undefined') {
    return { supported: false, readonly: true };
  }
  try {
    const db = await open();
    return { supported: true, readonly: db.objectStoreNames.length === 0 };
  } catch {
    return { supported: false, readonly: true };
  }
}

export async function listPlaces(): Promise<Place[]> {
  try {
    const db = await open();
    const all = await db.getAll(STORE_NAME);
    return all.filter(isPlace).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    throw wrapError('read your saved places', error);
  }
}

export async function putPlace(place: Place): Promise<void> {
  try {
    const db = await open();
    await db.put(STORE_NAME, place);
  } catch (error) {
    throw wrapError('save the place', error);
  }
}

export async function putManyPlaces(places: readonly Place[]): Promise<void> {
  if (places.length === 0) return;
  try {
    const db = await open();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await Promise.all([...places.map((place) => tx.store.put(place)), tx.done]);
  } catch (error) {
    throw wrapError('import the places', error);
  }
}

export async function deletePlace(id: string): Promise<void> {
  try {
    const db = await open();
    await db.delete(STORE_NAME, id);
  } catch (error) {
    throw wrapError('delete the place', error);
  }
}

export async function clearPlaces(): Promise<void> {
  try {
    const db = await open();
    await db.clear(STORE_NAME);
  } catch (error) {
    throw wrapError('clear your places', error);
  }
}

/** Test/maintenance helper: drop the cached connection. Closes the underlying IndexedDB handle. */
export async function resetConnection(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (!pending) return;
  try {
    const db = await pending;
    db.close();
  } catch {
    // The cached open already failed; nothing left to close.
  }
}
