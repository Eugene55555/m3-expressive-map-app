import {
  clearPlaces,
  deletePlace,
  listPlaces,
  putManyPlaces,
  putPlace,
} from './db.ts';
import { createId } from './id.ts';
import { parseImportJson, serializeExport, type ImportSummary } from './exportImport.ts';
import { sortPlaces, type SortOptions } from './search.ts';
import type { LoadStatus, Place, PlaceFieldErrors, PlaceFormValues } from './types.ts';
import { validatePlaceInput } from './validation.ts';

/** Thrown when form input fails validation; carries per-field messages. */
export class ValidationError extends Error {
  readonly errors: PlaceFieldErrors;

  constructor(errors: PlaceFieldErrors) {
    super('The form has validation errors.');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export interface ImportResult {
  added: number;
  replaced: number;
  skipped: number;
  errors: string[];
}

/**
 * Single source of truth for places. Holds an in-memory cache backed by
 * IndexedDB and notifies subscribers on every mutation so views can re-render.
 */
export class PlaceStore {
  private items: Place[] = [];
  private status: LoadStatus = 'loading';
  private error: string | null = null;
  private readonly listeners = new Set<() => void>();

  getPlaces(): readonly Place[] {
    return this.items;
  }

  getStatus(): LoadStatus {
    return this.status;
  }

  getError(): string | null {
    return this.error;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  async load(): Promise<void> {
    this.status = 'loading';
    this.error = null;
    this.emit();
    try {
      this.items = await listPlaces();
      this.status = 'ready';
    } catch (error) {
      this.status = 'error';
      this.error = error instanceof Error ? error.message : 'Could not load your saved places.';
    }
    this.emit();
  }

  getById(id: string): Place | undefined {
    return this.items.find((place) => place.id === id);
  }

  sorted(options: SortOptions): Place[] {
    return sortPlaces(this.items, options);
  }

  async create(form: PlaceFormValues): Promise<Place> {
    const validation = validatePlaceInput(form);
    if (!validation.ok) throw new ValidationError(validation.errors);

    const now = Date.now();
    const place: Place = {
      id: createId(),
      name: validation.value.name,
      lat: validation.value.lat,
      lng: validation.value.lng,
      note: validation.value.note,
      favorite: validation.value.favorite,
      createdAt: now,
      updatedAt: now,
    };
    await putPlace(place);
    this.items = [place, ...this.items];
    this.emit();
    return place;
  }

  async update(id: string, form: PlaceFormValues): Promise<Place> {
    const existing = this.getById(id);
    if (!existing) throw new Error('This place no longer exists.');
    const validation = validatePlaceInput(form);
    if (!validation.ok) throw new ValidationError(validation.errors);

    const updated: Place = {
      ...existing,
      name: validation.value.name,
      lat: validation.value.lat,
      lng: validation.value.lng,
      note: validation.value.note,
      favorite: validation.value.favorite,
      updatedAt: Date.now(),
    };
    await putPlace(updated);
    this.items = this.items.map((place) => (place.id === id ? updated : place));
    this.emit();
    return updated;
  }

  async remove(id: string): Promise<void> {
    await deletePlace(id);
    this.items = this.items.filter((place) => place.id !== id);
    this.emit();
  }

  /** Re-insert a removed place (used for undo), preserving its id. */
  async restore(place: Place): Promise<void> {
    await putPlace(place);
    this.items = [place, ...this.items.filter((item) => item.id !== place.id)];
    this.emit();
  }

  async toggleFavorite(id: string): Promise<void> {
    const existing = this.getById(id);
    if (!existing) return;
    const updated: Place = { ...existing, favorite: !existing.favorite, updatedAt: Date.now() };
    await putPlace(updated);
    this.items = this.items.map((place) => (place.id === id ? updated : place));
    this.emit();
  }

  async clearAll(): Promise<void> {
    await clearPlaces();
    this.items = [];
    this.emit();
  }

  /** Serialize all current places to a JSON string for download. */
  exportToJson(): string {
    return serializeExport(this.items);
  }

  /** Parse a JSON string without applying it (fatal errors throw ImportError). */
  parseImport(text: string): ImportSummary {
    return parseImportJson(text);
  }

  /** Merge a parsed import into storage; existing ids are replaced. */
  async applyImport(summary: ImportSummary): Promise<ImportResult> {
    const existingIds = new Set(this.items.map((place) => place.id));
    let added = 0;
    let replaced = 0;
    for (const place of summary.places) {
      if (existingIds.has(place.id)) replaced += 1;
      else added += 1;
    }
    await putManyPlaces(summary.places);
    const byId = new Map(this.items.map((place) => [place.id, place] as const));
    for (const place of summary.places) byId.set(place.id, place);
    this.items = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    this.emit();
    return { added, replaced, skipped: summary.skipped, errors: summary.errors };
  }
}

export const store = new PlaceStore();
