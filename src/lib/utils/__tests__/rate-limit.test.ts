import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkSlidingWindowRateLimit, clearSlidingWindowRateLimits } from '../rate-limit';

describe('checkSlidingWindowRateLimit', () => {
  beforeEach(() => {
    clearSlidingWindowRateLimits();
    vi.useRealTimers();
  });

  it('allows requests up to the configured limit', () => {
    const first = checkSlidingWindowRateLimit({ key: 'chat:user-1', limit: 2, windowMs: 60_000 });
    const second = checkSlidingWindowRateLimit({ key: 'chat:user-1', limit: 2, windowMs: 60_000 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it('blocks requests beyond the limit until the window expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T12:00:00Z'));

    checkSlidingWindowRateLimit({ key: 'chat:user-2', limit: 1, windowMs: 10_000 });
    const blocked = checkSlidingWindowRateLimit({ key: 'chat:user-2', limit: 1, windowMs: 10_000 });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);

    vi.advanceTimersByTime(10_001);

    const allowedAgain = checkSlidingWindowRateLimit({ key: 'chat:user-2', limit: 1, windowMs: 10_000 });
    expect(allowedAgain.allowed).toBe(true);
  });
});
