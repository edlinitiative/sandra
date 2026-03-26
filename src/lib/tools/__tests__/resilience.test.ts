import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withRetry,
  withTimeout,
  CircuitBreaker,
  CircuitOpenError,
  TimeoutError,
  setCorrelationId,
  getCorrelationId,
  clearCorrelationId,
  getToolResilienceConfig,
  isRetryableError,
  resetAllCircuitBreakers,
  getAllCircuitBreakerStats,
  getCircuitBreaker,
} from '../resilience';

describe('Resilience Layer', () => {
  beforeEach(() => {
    clearCorrelationId();
    resetAllCircuitBreakers();
  });

  // ─── Correlation IDs ──────────────────────────────────────────────────

  describe('Correlation IDs', () => {
    it('should generate a correlation ID if none is set', () => {
      const id = getCorrelationId();
      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    });

    it('should return the same ID once set', () => {
      setCorrelationId('req-123');
      expect(getCorrelationId()).toBe('req-123');
    });

    it('should reset on clearCorrelationId', () => {
      setCorrelationId('req-456');
      clearCorrelationId();
      const newId = getCorrelationId();
      expect(newId).not.toBe('req-456');
    });
  });

  // ─── Retry ────────────────────────────────────────────────────────────

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await withRetry(fn, 'test', { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, jitter: 0 });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, 'test', {
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 10,
        jitter: 0,
      });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always-fail'));

      await expect(
        withRetry(fn, 'test', { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 10, jitter: 0 }),
      ).rejects.toThrow('always-fail');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry if shouldRetry returns false', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('auth-error'));

      await expect(
        withRetry(fn, 'test', {
          maxAttempts: 3,
          baseDelayMs: 1,
          maxDelayMs: 10,
          jitter: 0,
          shouldRetry: () => false,
        }),
      ).rejects.toThrow('auth-error');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Timeout ──────────────────────────────────────────────────────────

  describe('withTimeout', () => {
    it('should resolve if function completes in time', async () => {
      const result = await withTimeout(
        () => Promise.resolve('fast'),
        1000,
        'test',
      );
      expect(result).toBe('fast');
    });

    it('should throw TimeoutError if function exceeds deadline', async () => {
      await expect(
        withTimeout(
          () => new Promise((resolve) => setTimeout(resolve, 500)),
          10,
          'slow-op',
        ),
      ).rejects.toThrow(TimeoutError);
    });

    it('should include label and timeout in TimeoutError', async () => {
      try {
        await withTimeout(
          () => new Promise((resolve) => setTimeout(resolve, 500)),
          5,
          'my-tool',
        );
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).label).toBe('my-tool');
        expect((error as TimeoutError).timeoutMs).toBe(5);
      }
    });

    it('should skip timeout when timeoutMs <= 0', async () => {
      const result = await withTimeout(() => Promise.resolve('ok'), 0, 'test');
      expect(result).toBe('ok');
    });
  });

  // ─── Circuit Breaker ──────────────────────────────────────────────────

  describe('CircuitBreaker', () => {
    it('should start in closed state', () => {
      const cb = new CircuitBreaker('test-cb');
      expect(cb.getState()).toBe('closed');
    });

    it('should let calls through when closed', async () => {
      const cb = new CircuitBreaker('test-cb');
      const result = await cb.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('should open after reaching failure threshold', async () => {
      const cb = new CircuitBreaker('test-cb', { failureThreshold: 3 });

      for (let i = 0; i < 3; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(cb.getState()).toBe('open');
    });

    it('should reject calls when open', async () => {
      const cb = new CircuitBreaker('test-cb', { failureThreshold: 2 });

      // Trip the breaker
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

      await expect(
        cb.execute(() => Promise.resolve('ok')),
      ).rejects.toThrow(CircuitOpenError);
    });

    it('should transition to half-open after reset timeout', async () => {
      const cb = new CircuitBreaker('test-cb', {
        failureThreshold: 1,
        resetTimeoutMs: 10,
      });

      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(cb.getState()).toBe('open');

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 20));
      expect(cb.getState()).toBe('half-open');
    });

    it('should close after successful calls in half-open', async () => {
      const cb = new CircuitBreaker('test-cb', {
        failureThreshold: 1,
        resetTimeoutMs: 10,
        halfOpenSuccessThreshold: 2,
      });

      // Trip it
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await new Promise((r) => setTimeout(r, 20));
      expect(cb.getState()).toBe('half-open');

      // Two successes in half-open
      await cb.execute(() => Promise.resolve('ok'));
      await cb.execute(() => Promise.resolve('ok'));
      expect(cb.getState()).toBe('closed');
    });

    it('should re-open on failure in half-open', async () => {
      const cb = new CircuitBreaker('test-cb', {
        failureThreshold: 1,
        resetTimeoutMs: 10,
      });

      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await new Promise((r) => setTimeout(r, 20));
      expect(cb.getState()).toBe('half-open');

      await cb.execute(() => Promise.reject(new Error('fail-again'))).catch(() => {});
      expect(cb.getState()).toBe('open');
    });

    it('should reset successfully', () => {
      const cb = new CircuitBreaker('test-cb');
      cb.reset();
      expect(cb.getState()).toBe('closed');
      expect(cb.getStats().failureCount).toBe(0);
    });
  });

  // ─── Circuit Breaker Registry ─────────────────────────────────────────

  describe('Circuit Breaker Registry', () => {
    it('should create and reuse circuit breakers by name', () => {
      const cb1 = getCircuitBreaker('registry-test');
      const cb2 = getCircuitBreaker('registry-test');
      expect(cb1).toBe(cb2);
    });

    it('should report stats for all circuit breakers', () => {
      getCircuitBreaker('stats-a');
      getCircuitBreaker('stats-b');
      const stats = getAllCircuitBreakerStats();
      expect(stats).toHaveProperty('stats-a');
      expect(stats).toHaveProperty('stats-b');
      expect(stats['stats-a']!.state).toBe('closed');
    });
  });

  // ─── Tool Resilience Config ───────────────────────────────────────────

  describe('getToolResilienceConfig', () => {
    it('should return configured settings for known tools', () => {
      const config = getToolResilienceConfig('searchKnowledgeBase');
      expect(config.timeoutMs).toBe(10_000);
      expect(config.circuitBreaker).toBe('vector-store');
    });

    it('should return defaults for unknown tools', () => {
      const config = getToolResilienceConfig('unknownTool');
      expect(config.timeoutMs).toBe(15_000);
      expect(config.retry).toEqual({ maxAttempts: 2 });
    });

    it('should have no retry for static data tools', () => {
      const config = getToolResilienceConfig('getEdLightInitiatives');
      expect(config.retry).toBeNull();
      expect(config.circuitBreaker).toBeNull();
    });

    it('should have longer timeout for indexing tool', () => {
      const config = getToolResilienceConfig('triggerRepoIndexing');
      expect(config.timeoutMs).toBe(60_000);
      expect(config.circuitBreaker).toBe('github');
    });
  });

  // ─── isRetryableError ─────────────────────────────────────────────────

  describe('isRetryableError', () => {
    it('should consider TimeoutError retryable', () => {
      expect(isRetryableError(new TimeoutError('test', 1000))).toBe(true);
    });

    it('should consider CircuitOpenError non-retryable', () => {
      expect(isRetryableError(new CircuitOpenError('test'))).toBe(false);
    });

    it('should consider ECONNREFUSED retryable', () => {
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('should consider rate limit errors retryable', () => {
      expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
    });

    it('should consider unknown errors non-retryable', () => {
      expect(isRetryableError(new Error('some random error'))).toBe(false);
    });
  });
});
