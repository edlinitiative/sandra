interface SlidingWindowOptions {
  key: string;
  limit: number;
  windowMs: number;
}

interface SlidingWindowResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  resetAt: number;
}

const slidingWindows = new Map<string, number[]>();

function pruneTimestamps(timestamps: number[], now: number, windowMs: number): number[] {
  return timestamps.filter((ts) => now - ts < windowMs);
}

/**
 * Simple in-memory sliding window rate limiter.
 * Good for single-instance / edge-light protections.
 */
export function checkSlidingWindowRateLimit({
  key,
  limit,
  windowMs,
}: SlidingWindowOptions): SlidingWindowResult {
  const now = Date.now();
  const existing = pruneTimestamps(slidingWindows.get(key) ?? [], now, windowMs);

  if (existing.length >= limit) {
    const oldest = existing[0] ?? now;
    const retryAfterMs = Math.max(0, windowMs - (now - oldest));
    slidingWindows.set(key, existing);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
      resetAt: oldest + windowMs,
    };
  }

  existing.push(now);
  slidingWindows.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.length),
    retryAfterMs: 0,
    resetAt: now + windowMs,
  };
}

export function clearSlidingWindowRateLimits() {
  slidingWindows.clear();
}
