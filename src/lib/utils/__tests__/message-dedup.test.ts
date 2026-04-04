import { describe, it, expect, beforeEach } from 'vitest';
import { isDuplicate, _resetForTest } from '../message-dedup';

describe('isDuplicate', () => {
  beforeEach(() => {
    _resetForTest();
  });

  it('returns false for the first occurrence of a message ID', () => {
    expect(isDuplicate('msg_001')).toBe(false);
  });

  it('returns true for a repeated message ID', () => {
    expect(isDuplicate('msg_002')).toBe(false);
    expect(isDuplicate('msg_002')).toBe(true);
  });

  it('returns false when messageId is undefined (no dedup possible)', () => {
    expect(isDuplicate(undefined)).toBe(false);
    expect(isDuplicate(undefined)).toBe(false); // still false — can't dedup
  });

  it('returns false when messageId is null', () => {
    expect(isDuplicate(null)).toBe(false);
  });

  it('returns false when messageId is empty string', () => {
    // empty string is falsy → treated as "no ID"
    expect(isDuplicate('')).toBe(false);
    expect(isDuplicate('')).toBe(false);
  });

  it('tracks multiple different IDs independently', () => {
    expect(isDuplicate('a')).toBe(false);
    expect(isDuplicate('b')).toBe(false);
    expect(isDuplicate('c')).toBe(false);
    expect(isDuplicate('a')).toBe(true);
    expect(isDuplicate('b')).toBe(true);
    expect(isDuplicate('c')).toBe(true);
  });

  it('allows the same ID again after TTL expires', () => {
    // Use a very short TTL (1 ms)
    expect(isDuplicate('msg_ttl', 1)).toBe(false);

    // Wait for it to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(isDuplicate('msg_ttl', 1)).toBe(false); // should be allowed again
        resolve();
      }, 10);
    });
  });

  it('resets cleanly between tests', () => {
    expect(isDuplicate('msg_reset')).toBe(false);
    _resetForTest();
    expect(isDuplicate('msg_reset')).toBe(false); // should be treated as new
  });
});
