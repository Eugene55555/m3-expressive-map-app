import type { Place, SortKey } from './types.ts';

/**
 * Split a query into lower-cased tokens. An empty query yields an empty list,
 * which `filterPlaces` treats as "match everything".
 */
export function tokenize(query: unknown): string[] {
  if (typeof query !== 'string') return [];
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/**
 * Local, private search over the user's own records. Every token must appear
 * in the name, the note, or the coordinate text (AND semantics). Nothing is
 * ever sent to a remote service.
 */
export function matchesQuery(place: Place, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = `${place.name}\n${place.note}\n${formatCoord(place.lat)}, ${formatCoord(place.lng)}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export function filterPlaces(places: readonly Place[], query: string): Place[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [...places];
  return places.filter((place) => matchesQuery(place, tokens));
}

function formatCoord(value: number): string {
  return value.toFixed(5);
}

/** Great-circle distance in kilometres between two coordinate pairs. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusKm = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export interface SortOptions {
  key: SortKey;
  /** Reference point for `distance` sorting (usually the user's location). */
  origin?: { lat: number; lng: number } | null;
}

/**
 * Return a new sorted array. `recent` orders by last update (newest first),
 * `name` is locale-aware ascending, `distance` is nearest first and falls back
 * to recency when no origin is available.
 */
export function sortPlaces(places: readonly Place[], options: SortOptions): Place[] {
  const list = [...places];
  switch (options.key) {
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    case 'distance': {
      const origin = options.origin;
      if (!origin) return list.sort((a, b) => b.updatedAt - a.updatedAt);
      return list.sort((a, b) => {
        const distanceA = haversineKm(origin.lat, origin.lng, a.lat, a.lng);
        const distanceB = haversineKm(origin.lat, origin.lng, b.lat, b.lng);
        if (distanceA === distanceB) return b.updatedAt - a.updatedAt;
        return distanceA - distanceB;
      });
    }
    case 'recent':
    default:
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
