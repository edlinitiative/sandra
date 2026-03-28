/**
 * LRU response cache for Sandra AI completions.
 *
 * Caches identical (model + message history) requests to avoid redundant
 * OpenAI API calls — improving latency and reducing cost for repeated queries.
 *
 * Cache characteristics:
 *  - Max 256 entries (LRU eviction when full)
 *  - 5-minute TTL per entry
 *  - Key: SHA-256 of (model + serialized messages)
 *  - Thread-safe for single-process use (Next.js)
 */

import { createHash } from 'crypto';
import type { ChatMessage } from './types';

export interface CachedCompletion {
  content: string;
  cachedAt: number; // epoch ms
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
}

const DEFAULT_MAX_SIZE = 256;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class LRUResponseCache {
  private readonly cache = new Map<string, CachedCompletion>();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private _hits = 0;
  private _misses = 0;

  constructor(maxSize = DEFAULT_MAX_SIZE, ttlMs = DEFAULT_TTL_MS) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate a stable cache key from model + messages.
   */
  buildKey(model: string, messages: ChatMessage[]): string {
    const payload = JSON.stringify({ model, messages });
    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Get a cached response. Returns null on miss or expiry.
   */
  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this._misses++;
      return null;
    }

    const age = Date.now() - entry.cachedAt;
    if (age > this.ttlMs) {
      // Expired — remove and report miss
      this.cache.delete(key);
      this._misses++;
      return null;
    }

    // LRU: move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this._hits++;
    return entry.content;
  }

  /**
   * Cache a response. Evicts the oldest entry if at capacity.
   */
  set(key: string, content: string): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first key in insertion order)
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, { content, cachedAt: Date.now() });
  }

  /**
   * Explicitly remove an entry.
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.cache.clear();
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * Purge all expired entries. Call periodically in background jobs.
   */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > this.ttlMs) {
        this.cache.delete(key);
        purged++;
      }
    }
    return purged;
  }

  getStats(): CacheStats {
    const total = this._hits + this._misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this._hits,
      misses: this._misses,
      hitRate: total === 0 ? 0 : Math.round((this._hits / total) * 100) / 100,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _cache: LRUResponseCache | null = null;

export function getResponseCache(): LRUResponseCache {
  if (!_cache) {
    _cache = new LRUResponseCache();
  }
  return _cache;
}
