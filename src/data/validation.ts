import type { PlaceFieldErrors, PlaceFormValues, PlaceValidationResult } from './types.ts';

export const NAME_MAX_LENGTH = 120;
export const NOTE_MAX_LENGTH = 2000;

export const LAT_MIN = -90;
export const LAT_MAX = 90;
export const LNG_MIN = -180;
export const LNG_MAX = 180;

/**
 * Trim a raw text value. Returns an empty string for nullish input so that
 * callers never store `"undefined"` or stray whitespace.
 */
export function cleanText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

/**
 * Collapse internal runs of whitespace for names (keeps a single space),
 * so "São  Paulo" and "São Paulo" compare equal.
 */
export function normalizeName(raw: unknown): string {
  return cleanText(raw).replace(/\s+/g, ' ');
}

/**
 * Parse a coordinate string. Accepts a decimal point or a decimal comma
 * (a common input on European keyboards) and trims surrounding spaces.
 */
export function parseCoordinate(raw: unknown): { ok: true; value: number } | { ok: false; reason: 'empty' | 'nan' } {
  const text = (typeof raw === 'string' ? raw : String(raw ?? '')).trim().replace(',', '.');
  if (text === '') return { ok: false, reason: 'empty' };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, reason: 'nan' };
  return { ok: true, value };
}

export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate fully-trimmed, finite place input.
 *
 * Rules:
 *  - name: required after trimming, at most NAME_MAX_LENGTH characters.
 *  - lat: required, finite, -90..90.
 *  - lng: required, finite, -180..180.
 *  - note: optional, at most NOTE_MAX_LENGTH characters.
 *
 * Invalid values are never returned as a `value`, which guarantees that
 * nothing malformed is written to storage.
 */
export function validatePlaceInput(input: Partial<PlaceFormValues> | null | undefined): PlaceValidationResult {
  const errors: PlaceFieldErrors = {};

  const name = normalizeName(input?.name);
  if (name.length === 0) {
    errors.name = 'Name is required.';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }

  let lat = Number.NaN;
  const parsedLat = parseCoordinate(input?.lat);
  if (!parsedLat.ok) {
    errors.lat = parsedLat.reason === 'empty' ? 'Latitude is required.' : 'Latitude must be a number.';
  } else if (!isInRange(parsedLat.value, LAT_MIN, LAT_MAX)) {
    errors.lat = `Latitude must be between ${LAT_MIN} and ${LAT_MAX}.`;
  } else {
    lat = parsedLat.value;
  }

  let lng = Number.NaN;
  const parsedLng = parseCoordinate(input?.lng);
  if (!parsedLng.ok) {
    errors.lng = parsedLng.reason === 'empty' ? 'Longitude is required.' : 'Longitude must be a number.';
  } else if (!isInRange(parsedLng.value, LNG_MIN, LNG_MAX)) {
    errors.lng = `Longitude must be between ${LNG_MIN} and ${LNG_MAX}.`;
  } else {
    lng = parsedLng.value;
  }

  const note = cleanText(input?.note);
  if (note.length > NOTE_MAX_LENGTH) {
    errors.note = `Note must be ${NOTE_MAX_LENGTH} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      lat,
      lng,
      note,
      favorite: input?.favorite === true,
    },
  };
}

export function hasFieldErrors(errors: PlaceFieldErrors): boolean {
  return Object.values(errors).some((value) => typeof value === 'string' && value.length > 0);
}
