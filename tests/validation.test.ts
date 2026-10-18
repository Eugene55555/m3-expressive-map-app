import { describe, expect, it } from 'vitest';
import {
  NAME_MAX_LENGTH,
  cleanText,
  normalizeName,
  parseCoordinate,
  validatePlaceInput,
} from '../src/data/validation.ts';

describe('cleanText / normalizeName', () => {
  it('trims surrounding whitespace', () => {
    expect(cleanText('  hello  ')).toBe('hello');
  });

  it('returns empty string for non-strings', () => {
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
    expect(cleanText(42)).toBe('');
  });

  it('collapses internal whitespace in names', () => {
    expect(normalizeName('São   Paulo')).toBe('São Paulo');
  });
});

describe('parseCoordinate', () => {
  it('parses a plain decimal', () => {
    expect(parseCoordinate('12.5')).toEqual({ ok: true, value: 12.5 });
  });

  it('accepts a decimal comma', () => {
    expect(parseCoordinate('48,858')).toEqual({ ok: true, value: 48.858 });
  });

  it('rejects empty input', () => {
    const result = parseCoordinate('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('empty');
  });

  it('rejects non-numeric input', () => {
    const result = parseCoordinate('north');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('nan');
  });
});

describe('validatePlaceInput', () => {
  it('accepts and trims a valid place', () => {
    const result = validatePlaceInput({
      name: '  Lookout point  ',
      lat: '48.858',
      lng: '2.294',
      note: '  nice view  ',
      favorite: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        name: 'Lookout point',
        lat: 48.858,
        lng: 2.294,
        note: 'nice view',
        favorite: true,
      });
    }
  });

  it('requires a non-empty name after trimming', () => {
    const result = validatePlaceInput({ name: '   ', lat: '0', lng: '0', note: '', favorite: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toMatch(/required/i);
  });

  it('rejects names that are too long', () => {
    const result = validatePlaceInput({
      name: 'a'.repeat(NAME_MAX_LENGTH + 1),
      lat: '0',
      lng: '0',
      note: '',
      favorite: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toMatch(/characters/i);
  });

  it('rejects out-of-range latitude', () => {
    const result = validatePlaceInput({ name: 'x', lat: '91', lng: '0', note: '', favorite: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.lat).toMatch(/between -90 and 90/i);
  });

  it('rejects out-of-range longitude', () => {
    const result = validatePlaceInput({ name: 'x', lat: '0', lng: '-181', note: '', favorite: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.lng).toMatch(/between -180 and 180/i);
  });

  it('rejects missing coordinates', () => {
    const result = validatePlaceInput({ name: 'x', lat: '', lng: '', note: '', favorite: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.lat).toMatch(/required/i);
      expect(result.errors.lng).toMatch(/required/i);
    }
  });

  it('rejects non-numeric coordinates', () => {
    const result = validatePlaceInput({ name: 'x', lat: 'abc', lng: 'def', note: '', favorite: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.lat).toMatch(/number/i);
      expect(result.errors.lng).toMatch(/number/i);
    }
  });

  it('accepts boundary values', () => {
    expect(validatePlaceInput({ name: 'a', lat: '-90', lng: '-180', note: '', favorite: false }).ok).toBe(true);
    expect(validatePlaceInput({ name: 'a', lat: '90', lng: '180', note: '', favorite: false }).ok).toBe(true);
  });

  it('never returns a value when invalid', () => {
    const result = validatePlaceInput(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect('value' in result).toBe(false);
  });
});
