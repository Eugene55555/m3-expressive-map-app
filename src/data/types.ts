/**
 * Core domain types for the saved-places app.
 *
 * A "place" is a personally saved location. Coordinates are stored as finite
 * decimal degrees. All records live only in the user's browser (IndexedDB).
 */

export interface Place {
  /** Stable unique identifier (crypto.randomUUID when available). */
  id: string;
  /** Trimmed, non-empty display name. */
  name: string;
  /** Latitude in decimal degrees, -90..90. */
  lat: number;
  /** Longitude in decimal degrees, -180..180. */
  lng: number;
  /** Optional free-form note (trimmed, may be empty). */
  note: string;
  /** Whether the user starred this place. */
  favorite: boolean;
  /** Epoch milliseconds when the place was created. */
  createdAt: number;
  /** Epoch milliseconds when the place was last updated. */
  updatedAt: number;
}

/** Raw values coming from the create/edit form, before validation. */
export interface PlaceFormValues {
  name: string;
  lat: string;
  lng: string;
  note: string;
  favorite: boolean;
}

export type PlaceFieldKey = 'name' | 'lat' | 'lng' | 'note';

export interface PlaceFieldErrors {
  name?: string;
  lat?: string;
  lng?: string;
  note?: string;
}

export interface ValidatedPlaceInput {
  name: string;
  lat: number;
  lng: number;
  note: string;
  favorite: boolean;
}

export type PlaceValidationResult =
  | { ok: true; value: ValidatedPlaceInput }
  | { ok: false; errors: PlaceFieldErrors };

export type SortKey = 'recent' | 'name' | 'distance';

export type LoadStatus = 'loading' | 'ready' | 'error';
