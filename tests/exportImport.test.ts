import { describe, expect, it } from 'vitest';
import {
  EXPORT_KIND,
  EXPORT_VERSION,
  ImportError,
  buildExportDocument,
  normalizeImportedPlace,
  parseImportJson,
  serializeExport,
} from '../src/data/exportImport.ts';
import type { Place } from '../src/data/types.ts';

const sample: Place = {
  id: 'abc',
  name: 'Lookout',
  lat: 48.858,
  lng: 2.294,
  note: 'nice',
  favorite: true,
  createdAt: 1000,
  updatedAt: 2000,
};

describe('buildExportDocument', () => {
  it('includes kind, version and count', () => {
    const doc = buildExportDocument([sample], new Date('2026-01-01T00:00:00Z'));
    expect(doc.kind).toBe(EXPORT_KIND);
    expect(doc.version).toBe(EXPORT_VERSION);
    expect(doc.count).toBe(1);
    expect(doc.exportedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(doc.places).toHaveLength(1);
  });

  it('serializes to valid JSON', () => {
    const parsed = JSON.parse(serializeExport([sample]));
    expect(parsed.places[0].name).toBe('Lookout');
  });
});

describe('parseImportJson', () => {
  it('round-trips an exported document', () => {
    const summary = parseImportJson(serializeExport([sample]));
    expect(summary.skipped).toBe(0);
    expect(summary.places).toHaveLength(1);
    expect(summary.places[0]).toEqual(sample);
  });

  it('accepts a bare array of places', () => {
    const summary = parseImportJson(JSON.stringify([sample]));
    expect(summary.places).toHaveLength(1);
  });

  it('throws a helpful error for invalid JSON', () => {
    expect(() => parseImportJson('{not json')).toThrow(ImportError);
  });

  it('throws when the file is from a different app', () => {
    expect(() => parseImportJson(JSON.stringify({ kind: 'other-app', places: [] }))).toThrow(ImportError);
  });

  it('throws when there is no places array', () => {
    expect(() => parseImportJson(JSON.stringify({ hello: 'world' }))).toThrow(ImportError);
  });

  it('skips invalid records and reports them', () => {
    const summary = parseImportJson(
      JSON.stringify({
        kind: EXPORT_KIND,
        places: [sample, { name: '', lat: 0, lng: 0 }, { name: 'Bad', lat: 200, lng: 0 }],
      }),
    );
    expect(summary.places).toHaveLength(1);
    expect(summary.skipped).toBe(2);
    expect(summary.errors).toHaveLength(2);
  });

  it('regenerates duplicate ids within one import', () => {
    const summary = parseImportJson(JSON.stringify([sample, { ...sample }]));
    expect(summary.places).toHaveLength(2);
    expect(summary.places[0].id).not.toBe(summary.places[1].id);
  });

  it('generates an id when one is missing', () => {
    const summary = parseImportJson(JSON.stringify([{ name: 'X', lat: 1, lng: 2 }]));
    expect(summary.places[0].id.length).toBeGreaterThan(0);
  });
});

describe('normalizeImportedPlace', () => {
  it('rejects non-objects', () => {
    expect('error' in normalizeImportedPlace(42)).toBe(true);
  });

  it('coerces numeric strings for coordinates', () => {
    const result = normalizeImportedPlace({ name: 'X', lat: '1.5', lng: '-2.5' });
    expect('place' in result).toBe(true);
    if ('place' in result) {
      expect(result.place.lat).toBe(1.5);
      expect(result.place.lng).toBe(-2.5);
    }
  });
});
