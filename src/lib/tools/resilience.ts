import { createLogger } from '@/lib/utils';

const log = createLogger('tools:resilience');

// ─── Correlation IDs ────────────────────────────────────────────────────────

let _correlationId: string | undefined;

/** Set the current request's correlation ID (call at gateway entry). */
export function setCorrelationId(id: string): void {
  _correlationId = id;
}

/** Get the current correlation ID, or generate one. */
export function getCorrelationId(): string {
  if (!_correlationId) {
    _correlationId = crypto.randomUUID();
  }
  return _correlationId;
}

/** Clear correlation ID (call at request end). */
export function clearCorrelationId(): void {
  _correlationId = undefined;
}

// ─── Retry with Exponential Backoff ─────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts: number;
  /** Initial delay in ms before first retry. Default: 200 */
  baseDelayMs: number;
  /** Maximum delay in ms. Default: 5000 */
  maxDelayMs: number;
  /** Jitter factor (0–1). Default: 0.3 */
  jitter: number;
  /** Predicate: should we retry this error? Default: always true */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 5000,
  jitter: 0.3,
};

/**
 * Execute an async function with retry and exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  opts?: Partial<RetryOptions>,
): Promise<T> {
  const options = { ...DEFAULT_RETRY_OPTIONS, ...opts };
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= options.maxAttempts) {
        break;
      }

      // Check if we should retry
      if (options.shouldRetry && !options.shouldRetry(error, attempt)) {
        log.info(`[${label}] Non-retryable error on attempt ${attempt}`, {
          correlationId: getCorrelationId(),
        });
        break;
      }

      // Calculate delay: exponential backoff with jitter
      const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt - 1);
      const jitterAmount = exponentialDelay * options.jitter * Math.random();
      const delay = Math.min(exponentialDelay + jitterAmount, options.maxDelayMs);

      log.warn(`[${label}] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`, {
        correlationId: getCorrelationId(),
        error: error instanceof Error ? error.message : 'unknown',
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

// ─── Timeout ────────────────────────────────────────────────────────────────

export class TimeoutError extends Error {
  constructor(
    public readonly label: string,
    public readonly timeoutMs: number,
  ) {
    super(`Operation '${label}' timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Execute a function with a timeout.
 * Rejects with TimeoutError if the function exceeds the deadline.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  if (timeoutMs <= 0) return fn();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(label, timeoutMs));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening. Default: 5 */
  failureThreshold: number;
  /** Time in ms before transitioning from open to half-open. Default: 30000 (30s) */
  resetTimeoutMs: number;
  /** Number of successful calls in half-open before closing. Default: 2 */
  halfOpenSuccessThreshold: number;
}

export const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 2,
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly options: CircuitBreakerOptions;
  readonly name: string;

  constructor(name: string, opts?: Partial<CircuitBreakerOptions>) {
    this.name = name;
    this.options = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...opts };
  }

  /** Get the current circuit state. */
  getState(): CircuitState {
    if (this.state === 'open' && this.shouldTransitionToHalfOpen()) {
      this.state = 'half-open';
      this.successCount = 0;
      log.info(`[CircuitBreaker:${this.name}] Transitioning to half-open`);
    }
    return this.state;
  }

  /** Get diagnostics for monitoring. */
  getStats(): { state: CircuitState; failureCount: number; successCount: number; lastFailureTime: number } {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'open') {
      throw new CircuitOpenError(this.name);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /** Reset the circuit breaker to closed state. */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    log.info(`[CircuitBreaker:${this.name}] Reset to closed`);
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenSuccessThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        log.info(`[CircuitBreaker:${this.name}] Closed after successful half-open probes`);
      }
    } else {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Single failure in half-open reopens the circuit
      this.state = 'open';
      log.warn(`[CircuitBreaker:${this.name}] Re-opened after half-open failure`);
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'open';
      log.warn(`[CircuitBreaker:${this.name}] Opened after ${this.failureCount} consecutive failures`);
    }
  }

  private shouldTransitionToHalfOpen(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs;
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly circuitName: string) {
    super(`Circuit '${circuitName}' is open — request rejected`);
    this.name = 'CircuitOpenError';
  }
}

// ─── Circuit Breaker Registry ───────────────────────────────────────────────

const circuitBreakers = new Map<string, CircuitBreaker>();

/** Get or create a circuit breaker by name. */
export function getCircuitBreaker(name: string, opts?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  let cb = circuitBreakers.get(name);
  if (!cb) {
    cb = new CircuitBreaker(name, opts);
    circuitBreakers.set(name, cb);
  }
  return cb;
}

/** Get all circuit breaker stats for monitoring. */
export function getAllCircuitBreakerStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
  const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
  for (const [name, cb] of circuitBreakers) {
    stats[name] = cb.getStats();
  }
  return stats;
}

/** Reset all circuit breakers (useful in tests). */
export function resetAllCircuitBreakers(): void {
  for (const cb of circuitBreakers.values()) {
    cb.reset();
  }
}

// ─── Tool-specific configuration ────────────────────────────────────────────

export interface ToolResilienceConfig {
  /** Timeout for this tool in ms. 0 = no timeout. */
  timeoutMs: number;
  /** Retry options for this tool. null = no retry. */
  retry: Partial<RetryOptions> | null;
  /** Use circuit breaker? Null means no circuit breaker. */
  circuitBreaker: string | null;
}

/** Default resilience settings per tool. Tools not listed use defaults. */
const TOOL_RESILIENCE_CONFIGS: Record<string, Partial<ToolResilienceConfig>> = {
  // Knowledge tools — moderate timeout, retry on transient errors
  searchKnowledgeBase: { timeoutMs: 10_000, retry: { maxAttempts: 2 }, circuitBreaker: 'vector-store' },
  lookupRepoInfo: { timeoutMs: 8_000, retry: { maxAttempts: 2 }, circuitBreaker: 'github' },

  // Static data tools — fast, no retry needed
  getEdLightInitiatives: { timeoutMs: 3_000, retry: null, circuitBreaker: null },
  getCourseInventory: { timeoutMs: 3_000, retry: null, circuitBreaker: null },
  getProgramsAndScholarships: { timeoutMs: 3_000, retry: null, circuitBreaker: null },
  getLatestNews: { timeoutMs: 3_000, retry: null, circuitBreaker: null },
  getProgramDeadlines: { timeoutMs: 3_000, retry: null, circuitBreaker: null },
  getContactInfo: { timeoutMs: 3_000, retry: null, circuitBreaker: null },

  // Private user tools — moderate timeout, retry on DB transient errors
  getUserProfileSummary: { timeoutMs: 8_000, retry: { maxAttempts: 2 }, circuitBreaker: 'database' },
  getUserEnrollments: { timeoutMs: 8_000, retry: { maxAttempts: 2 }, circuitBreaker: 'database' },
  getUserCertificates: { timeoutMs: 8_000, retry: { maxAttempts: 2 }, circuitBreaker: 'database' },
  getApplicationStatus: { timeoutMs: 8_000, retry: { maxAttempts: 2 }, circuitBreaker: 'database' },

  // Admin tools — longer timeout, retry on external calls
  triggerRepoIndexing: { timeoutMs: 60_000, retry: { maxAttempts: 2 }, circuitBreaker: 'github' },
  getIndexingStatus: { timeoutMs: 8_000, retry: { maxAttempts: 2 }, circuitBreaker: 'database' },
  listConnectedSystems: { timeoutMs: 10_000, retry: null, circuitBreaker: null },
  viewSystemHealth: { timeoutMs: 10_000, retry: { maxAttempts: 2 }, circuitBreaker: null },
};

const DEFAULT_TOOL_RESILIENCE: ToolResilienceConfig = {
  timeoutMs: 15_000,
  retry: { maxAttempts: 2 },
  circuitBreaker: null,
};

/** Get resilience configuration for a specific tool. */
export function getToolResilienceConfig(toolName: string): ToolResilienceConfig {
  const override = TOOL_RESILIENCE_CONFIGS[toolName] ?? {};
  return { ...DEFAULT_TOOL_RESILIENCE, ...override };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine whether an error is transient and worth retrying.
 * Database connection errors, network timeouts, and 5xx responses are retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (error instanceof CircuitOpenError) return false;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Database transient errors
    if (/econnrefused|econnreset|etimedout|connection.*reset|connection.*refused/.test(msg)) return true;
    // HTTP 5xx style errors
    if (/5\d{2}|server error|service unavailable|gateway timeout|bad gateway/.test(msg)) return true;
    // Rate limits are retryable
    if (/rate.?limit|429|too many requests/.test(msg)) return true;
  }

  return false;
}
