/**
 * Tests for ActionRateLimiter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ActionRateLimiter } from '../rate-limiter';

describe('ActionRateLimiter', () => {
  let limiter: ActionRateLimiter;

  beforeEach(() => {
    limiter = new ActionRateLimiter();
  });

  describe('isAllowed', () => {
    it('returns true when under limit', () => {
      expect(limiter.isAllowed('user1', 'testTool', { maxRequests: 3, windowMs: 60_000 })).toBe(true);
    });

    it('returns false after limit is exceeded', () => {
      const config = { maxRequests: 2, windowMs: 60_000 };
      limiter.consume('user1', 'testTool', config);
      limiter.consume('user1', 'testTool', config);
      expect(limiter.isAllowed('user1', 'testTool', config)).toBe(false);
    });

    it('does not affect other users', () => {
      const config = { maxRequests: 1, windowMs: 60_000 };
      limiter.consume('user1', 'testTool', config);
      expect(limiter.isAllowed('user2', 'testTool', config)).toBe(true);
    });

    it('does not affect other tools for the same user', () => {
      const config = { maxRequests: 1, windowMs: 60_000 };
      limiter.consume('user1', 'toolA', config);
      expect(limiter.isAllowed('user1', 'toolB', config)).toBe(true);
    });
  });

  describe('consume', () => {
    it('returns true and decrements remaining', () => {
      const config = { maxRequests: 3, windowMs: 60_000 };
      expect(limiter.consume('user1', 'testTool', config)).toBe(true);
      expect(limiter.remaining('user1', 'testTool', config)).toBe(2);
    });

    it('returns false when at limit', () => {
      const config = { maxRequests: 1, windowMs: 60_000 };
      limiter.consume('user1', 'testTool', config);
      expect(limiter.consume('user1', 'testTool', config)).toBe(false);
    });

    it('remaining never goes below zero', () => {
      const config = { maxRequests: 1, windowMs: 60_000 };
      limiter.consume('user1', 'testTool', config);
      limiter.consume('user1', 'testTool', config); // over-consume
      expect(limiter.remaining('user1', 'testTool', config)).toBe(0);
    });
  });

  describe('remaining', () => {
    it('returns full limit for an unseen key', () => {
      const config = { maxRequests: 5, windowMs: 60_000 };
      expect(limiter.remaining('newUser', 'newTool', config)).toBe(5);
    });
  });

  describe('reset', () => {
    it('clears state for a specific user+tool key', () => {
      const config = { maxRequests: 2, windowMs: 60_000 };
      limiter.consume('user1', 'testTool', config);
      limiter.reset('user1', 'testTool');
      expect(limiter.remaining('user1', 'testTool', config)).toBe(2);
    });
  });

  describe('resetAll', () => {
    it('clears all state', () => {
      const config = { maxRequests: 1, windowMs: 60_000 };
      limiter.consume('user1', 'toolA', config);
      limiter.consume('user2', 'toolB', config);
      limiter.resetAll();
      expect(limiter.remaining('user1', 'toolA', config)).toBe(1);
      expect(limiter.remaining('user2', 'toolB', config)).toBe(1);
    });
  });

  describe('sliding window expiry', () => {
    it('allows requests again after the window expires', async () => {
      const config = { maxRequests: 1, windowMs: 50 }; // 50ms window
      limiter.consume('user1', 'testTool', config);
      expect(limiter.isAllowed('user1', 'testTool', config)).toBe(false);

      // Wait for the window to expire
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(limiter.isAllowed('user1', 'testTool', config)).toBe(true);
    });
  });
});
