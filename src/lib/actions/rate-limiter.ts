/**
 * Action rate limiter.
 *
 * Sliding-window, in-memory rate limiting per (userId, toolName).
 * Prevents a single user from flooding the action queue with repeated requests.
 *
 * For production deployments at scale this should be backed by Redis; the
 * interface is the same — just swap the in-memory store for a Redis ZADD/ZCOUNT.
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window. */
  maxRequests: number;
  /** Window duration in milliseconds (e.g. 60_000 for 1 min). */
  windowMs: number;
}

/** Default per-tool limits (requests per 10 minutes). */
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  createLead:          { maxRequests: 3,  windowMs: 10 * 60 * 1000 },
  submitInterestForm:  { maxRequests: 5,  windowMs: 10 * 60 * 1000 },
  queueReminder:       { maxRequests: 10, windowMs: 10 * 60 * 1000 },
  draftEmail:          { maxRequests: 2,  windowMs: 10 * 60 * 1000 },
  recommendCourses:    { maxRequests: 20, windowMs: 10 * 60 * 1000 },
};

const FALLBACK_LIMIT: RateLimitConfig = { maxRequests: 10, windowMs: 10 * 60 * 1000 };

export class ActionRateLimiter {
  /** Map<`userId:tool`, sorted timestamp array> */
  private readonly buckets = new Map<string, number[]>();

  private getConfig(toolName: string, override?: RateLimitConfig): RateLimitConfig {
    return override ?? DEFAULT_LIMITS[toolName] ?? FALLBACK_LIMIT;
  }

  private key(userId: string, toolName: string): string {
    return `${userId}:${toolName}`;
  }

  /** Purge timestamps outside the current window. */
  private prune(timestamps: number[], windowMs: number): number[] {
    const cutoff = Date.now() - windowMs;
    return timestamps.filter((t) => t > cutoff);
  }

  /**
   * Check whether a request is allowed without consuming a slot.
   */
  isAllowed(userId: string, toolName: string, override?: RateLimitConfig): boolean {
    const config = this.getConfig(toolName, override);
    const k = this.key(userId, toolName);
    const raw = this.buckets.get(k) ?? [];
    const pruned = this.prune(raw, config.windowMs);
    return pruned.length < config.maxRequests;
  }

  /**
   * Consume one request slot. Returns false if the rate limit is exceeded.
   */
  consume(userId: string, toolName: string, override?: RateLimitConfig): boolean {
    const config = this.getConfig(toolName, override);
    const k = this.key(userId, toolName);
    const raw = this.buckets.get(k) ?? [];
    const pruned = this.prune(raw, config.windowMs);

    if (pruned.length >= config.maxRequests) {
      this.buckets.set(k, pruned);
      return false;
    }

    pruned.push(Date.now());
    this.buckets.set(k, pruned);
    return true;
  }

  /**
   * How many requests remain in the current window.
   */
  remaining(userId: string, toolName: string, override?: RateLimitConfig): number {
    const config = this.getConfig(toolName, override);
    const k = this.key(userId, toolName);
    const raw = this.buckets.get(k) ?? [];
    const pruned = this.prune(raw, config.windowMs);
    this.buckets.set(k, pruned);
    return Math.max(0, config.maxRequests - pruned.length);
  }

  /** Reset the bucket for a user+tool (useful in tests). */
  reset(userId: string, toolName: string): void {
    this.buckets.delete(this.key(userId, toolName));
  }

  /** Reset all buckets (useful in tests). */
  resetAll(): void {
    this.buckets.clear();
  }
}

/** Global singleton rate limiter. */
export const actionRateLimiter = new ActionRateLimiter();
