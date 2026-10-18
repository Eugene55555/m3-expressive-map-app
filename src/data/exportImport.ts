import { createId } from './id.ts';
import type { Place } from './types.ts';
import { validatePlaceInput } from './validation.ts';

export const EXPORT_KIND = 'm3-expressive-map-app';
export const EXPORT_VERSION = 1;

export interface ExportDocument {
  kind: typeof EXPORT_KIND;
  version: number;
  exportedAt: string;
  count: number;
  places: Place[];
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export interface ImportSummary {
  places: Place[];
  skipped: number;
  errors: string[];
}

/** Build the JSON document used for export. */
export function buildExportDocument(places: readonly Place[], now: Date = new Date()): ExportDocument {
  return {
    kind: EXPORT_KIND,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    count: places.length,
    places: places.map((place) => ({ ...place })),
  };
}

export function serializeExport(places: readonly Place[], now: Date = new Date()): string {
  return JSON.stringify(buildExportDocument(places, now), null, 2);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toTimestamp(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

/**
 * Coerce one raw imported record into a valid Place, or return a reason why it
 * was rejected. Only fully valid coordinates and a non-empty name survive.
 */
export function normalizeImportedPlace(raw: unknown, now: number = Date.now()): { place: Place } | { error: string } {
  const record = toRecord(raw);
  if (!record) return { error: 'Record is not an object.' };

  const result = validatePlaceInput({
    name: typeof record.name === 'string' ? record.name : String(record.name ?? ''),
    lat: record.lat === undefined || record.lat === null ? '' : String(record.lat),
    lng: record.lng === undefined || record.lng === null ? '' : String(record.lng),
    note: typeof record.note === 'string' ? record.note : '',
    favorite: record.favorite === true,
  });

  if (!result.ok) {
    const first = Object.values(result.errors)[0] ?? 'Invalid record.';
    return { error: first };
  }

  const rawId = typeof record.id === 'string' ? record.id.trim() : '';
  const createdAt = toTimestamp(record.createdAt, now);
  return {
    place: {
      id: rawId.length > 0 ? rawId : createId(),
      name: result.value.name,
      lat: result.value.lat,
      lng: result.value.lng,
      note: result.value.note,
      favorite: result.value.favorite,
      createdAt,
      updatedAt: toTimestamp(record.updatedAt, createdAt),
    },
  };
}

/**
 * Parse an exported file (or a bare array of places). Per-record problems are
 * collected rather than failing the whole import; structural problems throw an
 * ImportError so the UI can explain exactly what went wrong.
 */
export function parseImportJson(text: string, now: number = Date.now()): ImportSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError('The file is not valid JSON.');
  }

  let rawPlaces: unknown;
  if (Array.isArray(parsed)) {
    rawPlaces = parsed;
  } else {
    const record = toRecord(parsed);
    if (!record) throw new ImportError('The file must contain a JSON object or an array of places.');
    if (typeof record.kind === 'string' && record.kind !== EXPORT_KIND) {
      throw new ImportError('This JSON file was not produced by this app.');
    }
    rawPlaces = record.places;
    if (rawPlaces === undefined && Array.isArray(record.items)) {
      rawPlaces = record.items;
    }
  }

  if (!Array.isArray(rawPlaces)) {
    throw new ImportError('No "places" array was found in the file.');
  }

  const places: Place[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  let skipped = 0;

  rawPlaces.forEach((entry, index) => {
    const normalized = normalizeImportedPlace(entry, now);
    if ('error' in normalized) {
      skipped += 1;
      errors.push(`Item ${index + 1}: ${normalized.error}`);
      return;
    }
    if (seen.has(normalized.place.id)) {
      normalized.place.id = createId();
    }
    seen.add(normalized.place.id);
    places.push(normalized.place);
  });

  return { places, skipped, errors };
}
