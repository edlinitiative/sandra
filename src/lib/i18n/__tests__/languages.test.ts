import { describe, it, expect } from 'vitest';
import { resolveLanguage, normalizeLanguageCode, getLanguageInstruction } from '../languages';
import { isValidLanguage, DEFAULT_LANGUAGE } from '../types';

describe('isValidLanguage', () => {
  it('returns true for supported language codes', () => {
    expect(isValidLanguage('en')).toBe(true);
    expect(isValidLanguage('fr')).toBe(true);
    expect(isValidLanguage('ht')).toBe(true);
  });

  it('returns false for unsupported codes', () => {
    expect(isValidLanguage('de')).toBe(false);
    expect(isValidLanguage('es')).toBe(false);
    expect(isValidLanguage('')).toBe(false);
    expect(isValidLanguage(null)).toBe(false);
    expect(isValidLanguage(undefined)).toBe(false);
    expect(isValidLanguage(42)).toBe(false);
  });
});

describe('DEFAULT_LANGUAGE', () => {
  it('is en', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });
});

describe('resolveLanguage', () => {
  it('returns explicit language when valid', () => {
    expect(resolveLanguage({ explicit: 'fr' })).toBe('fr');
  });

  it('falls back to sessionLanguage when explicit is invalid', () => {
    expect(resolveLanguage({ explicit: 'invalid', sessionLanguage: 'ht' })).toBe('ht');
  });

  it('falls back to DEFAULT_LANGUAGE when both are missing', () => {
    expect(resolveLanguage({})).toBe('en');
  });

  it('falls back to DEFAULT_LANGUAGE when explicit is invalid and no session language', () => {
    expect(resolveLanguage({ explicit: 'invalid' })).toBe('en');
  });

  it('uses sessionLanguage when explicit is not provided', () => {
    expect(resolveLanguage({ sessionLanguage: 'fr' })).toBe('fr');
  });

  it('explicit takes priority over sessionLanguage', () => {
    expect(resolveLanguage({ explicit: 'en', sessionLanguage: 'fr' })).toBe('en');
  });
});

describe('normalizeLanguageCode', () => {
  it('normalizes valid codes', () => {
    expect(normalizeLanguageCode('en')).toBe('en');
    expect(normalizeLanguageCode('fr')).toBe('fr');
    expect(normalizeLanguageCode('ht')).toBe('ht');
  });

  it('returns en for null/undefined', () => {
    expect(normalizeLanguageCode(null)).toBe('en');
    expect(normalizeLanguageCode(undefined)).toBe('en');
  });

  it('returns en for unknown codes', () => {
    expect(normalizeLanguageCode('de')).toBe('en');
  });

  it('handles kr variant for Haitian Creole', () => {
    expect(normalizeLanguageCode('kr')).toBe('ht');
  });
});

describe('getLanguageInstruction', () => {
  it('contains Haitian Creole for ht', () => {
    expect(getLanguageInstruction('ht')).toContain('Haitian Creole');
  });

  it('contains French for fr', () => {
    expect(getLanguageInstruction('fr')).toContain('French');
  });

  it('returns an instruction for en', () => {
    const instruction = getLanguageInstruction('en');
    expect(typeof instruction).toBe('string');
    expect(instruction.length).toBeGreaterThan(0);
  });
});
