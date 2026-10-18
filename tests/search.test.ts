import { describe, expect, it } from 'vitest';
import { filterPlaces, haversineKm, sortPlaces, tokenize } from '../src/data/search.ts';
import type { Place } from '../src/data/types.ts';

function place(partial: Partial<Place> & Pick<Place, 'id' | 'name'>): Place {
  return {
    lat: 0,
    lng: 0,
    note: '',
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

const places: Place[] = [
  place({ id: '1', name: 'Home', lat: 51.5, lng: -0.12, note: 'flat', updatedAt: 10 }),
  place({ id: '2', name: 'Work', lat: 48.85, lng: 2.35, note: 'office', updatedAt: 30 }),
  place({ id: '3', name: 'Café', lat: 40.71, lng: -74.0, note: 'coffee and cake', updatedAt: 20 }),
];

describe('tokenize', () => {
  it('lowercases and splits on whitespace', () => {
    expect(tokenize('  Big  Ben ')).toEqual(['big', 'ben']);
  });

  it('returns an empty list for blank input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('filterPlaces', () => {
  it('returns everything for an empty query', () => {
    expect(filterPlaces(places, '')).toHaveLength(3);
  });

  it('matches names case-insensitively', () => {
    expect(filterPlaces(places, 'home').map((p) => p.id)).toEqual(['1']);
  });

  it('matches notes', () => {
    expect(filterPlaces(places, 'coffee').map((p) => p.id)).toEqual(['3']);
  });

  it('requires every token to match (AND)', () => {
    expect(filterPlaces(places, 'coffee cake').map((p) => p.id)).toEqual(['3']);
    expect(filterPlaces(places, 'coffee office')).toHaveLength(0);
  });

  it('matches coordinates text', () => {
    expect(filterPlaces(places, '48.85').map((p) => p.id)).toEqual(['2']);
  });
});

describe('sortPlaces', () => {
  it('sorts by recency by default', () => {
    expect(sortPlaces(places, { key: 'recent' }).map((p) => p.id)).toEqual(['2', '3', '1']);
  });

  it('sorts by name', () => {
    expect(sortPlaces(places, { key: 'name' }).map((p) => p.name)).toEqual(['Café', 'Home', 'Work']);
  });

  it('sorts by distance when an origin is given', () => {
    const sorted = sortPlaces(places, { key: 'distance', origin: { lat: 51.5, lng: -0.12 } });
    expect(sorted[0].id).toBe('1');
  });

  it('falls back to recency for distance without an origin', () => {
    expect(sortPlaces(places, { key: 'distance', origin: null }).map((p) => p.id)).toEqual(['2', '3', '1']);
  });
});

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(10, 20, 10, 20)).toBe(0);
  });

  it('approximates a known distance', () => {
    // London -> Paris is roughly 344 km.
    const distance = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distance).toBeGreaterThan(330);
    expect(distance).toBeLessThan(360);
  });
});
