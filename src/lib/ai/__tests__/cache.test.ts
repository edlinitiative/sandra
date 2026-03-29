import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LRUResponseCache, getResponseCache } from '@/lib/ai/cache';
import type { ChatMessage } from '@/lib/ai/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMessages(content: string): ChatMessage[] {
  return [{ role: 'user', content }];
}

// ─── buildKey ────────────────────────────────────────────────────────────────

describe('LRUResponseCache.buildKey', () => {
  it('returns a 64-char hex SHA-256 digest', () => {
    const cache = new LRUResponseCache();
    const key = cache.buildKey('gpt-4o', makeMessages('hello'));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same inputs produce same key', () => {
    const cache = new LRUResponseCache();
    const msgs = makeMessages('test');
    const k1 = cache.buildKey('gpt-4o', msgs);
    const k2 = cache.buildKey('gpt-4o', msgs);
    expect(k1).toBe(k2);
  });

  it('is different for different models', () => {
    const cache = new LRUResponseCache();
    const msgs = makeMessages('test');
    const k1 = cache.buildKey('gpt-4o', msgs);
    const k2 = cache.buildKey('gpt-4o-mini', msgs);
    expect(k1).not.toBe(k2);
  });

  it('is different for different message content', () => {
    const cache = new LRUResponseCache();
    const k1 = cache.buildKey('gpt-4o', makeMessages('hello'));
    const k2 = cache.buildKey('gpt-4o', makeMessages('world'));
    expect(k1).not.toBe(k2);
  });
});

// ─── get / set ───────────────────────────────────────────────────────────────

describe('LRUResponseCache get/set', () => {
  let cache: LRUResponseCache;

  beforeEach(() => {
    cache = new LRUResponseCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('stores and retrieves a value', () => {
    cache.set('key1', 'hello world');
    expect(cache.get('key1')).toBe('hello world');
  });

  it('returns null after TTL expiry', () => {
    const shortCache = new LRUResponseCache(256, 1000); // 1 second TTL
    shortCache.set('key1', 'value');
    vi.advanceTimersByTime(1001);
    expect(shortCache.get('key1')).toBeNull();
  });

  it('returns value before TTL expiry', () => {
    const shortCache = new LRUResponseCache(256, 1000);
    shortCache.set('key1', 'value');
    vi.advanceTimersByTime(999);
    expect(shortCache.get('key1')).toBe('value');
  });

  it('overwrites duplicate keys', () => {
    cache.set('key1', 'v1');
    cache.set('key1', 'v2');
    expect(cache.get('key1')).toBe('v2');
    expect(cache.getStats().size).toBe(1);
  });

  it('deletes an entry', () => {
    cache.set('key1', 'v1');
    cache.delete('key1');
    expect(cache.get('key1')).toBeNull();
  });

  it('clear() empties the cache and resets stats', () => {
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    cache.get('k1');
    cache.clear();
    expect(cache.getStats()).toMatchObject({ size: 0, hits: 0, misses: 0, hitRate: 0 });
  });
});

// ─── LRU eviction ────────────────────────────────────────────────────────────

describe('LRU eviction', () => {
  it('evicts the least-recently-used entry when at capacity', () => {
    const cache = new LRUResponseCache(3);
    cache.set('a', 'a');
    cache.set('b', 'b');
    cache.set('c', 'c');
    // Access 'a' to make it recently used
    cache.get('a');
    // Now add 'd' — 'b' should be evicted (oldest not recently used)
    cache.set('d', 'd');
    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')).toBe('a');
    expect(cache.get('c')).toBe('c');
    expect(cache.get('d')).toBe('d');
  });

  it('stays within maxSize at all times', () => {
    const cache = new LRUResponseCache(5);
    for (let i = 0; i < 20; i++) {
      cache.set(`key-${i}`, `val-${i}`);
    }
    expect(cache.getStats().size).toBeLessThanOrEqual(5);
  });
});

// ─── purgeExpired ────────────────────────────────────────────────────────────

describe('purgeExpired', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('removes expired entries and returns count', () => {
    const cache = new LRUResponseCache(256, 1000);
    cache.set('a', 'a');
    cache.set('b', 'b');
    vi.advanceTimersByTime(1001);
    cache.set('c', 'c'); // fresh entry
    const purged = cache.purgeExpired();
    expect(purged).toBe(2);
    expect(cache.getStats().size).toBe(1);
  });

  it('returns 0 when nothing is expired', () => {
    const cache = new LRUResponseCache(256, 5000);
    cache.set('a', 'a');
    const purged = cache.purgeExpired();
    expect(purged).toBe(0);
  });
});

// ─── getStats ────────────────────────────────────────────────────────────────

describe('getStats', () => {
  it('tracks hits and misses accurately', () => {
    const cache = new LRUResponseCache();
    cache.set('k', 'v');
    cache.get('k');   // hit
    cache.get('k');   // hit
    cache.get('x');   // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.67, 1);
  });

  it('returns 0 hitRate when no requests made', () => {
    const cache = new LRUResponseCache();
    expect(cache.getStats().hitRate).toBe(0);
  });
});

// ─── getResponseCache singleton ─────────────────────────────────────────────

describe('getResponseCache', () => {
  it('returns the same instance on repeated calls', () => {
    const c1 = getResponseCache();
    const c2 = getResponseCache();
    expect(c1).toBe(c2);
  });

  it('returns an LRUResponseCache instance', () => {
    expect(getResponseCache()).toBeInstanceOf(LRUResponseCache);
  });
});
