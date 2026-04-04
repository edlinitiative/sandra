/**
 * In-memory message deduplication with TTL.
 *
 * Meta webhooks may deliver the same event multiple times (retries, network
 * glitches, edge routing). This guard ensures Sandra processes each message
 * exactly once.
 *
 * We use a simple Map<string, number> keyed by message ID with expiry
 * timestamps. A periodic sweep removes expired entries to avoid unbounded
 * memory growth. On Vercel serverless, each cold-start gets a fresh Map —
 * but within the same warm instance, retries that arrive seconds apart are
 * correctly deduped.
 */

import { createLogger } from './logger';

const log = createLogger('utils:message-dedup');

/** Default TTL: 5 minutes. Meta retries within ~30 s, so 5 min is generous. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Sweep interval: run cleanup every 60 s. */
const SWEEP_INTERVAL_MS = 60 * 1000;

const seen = new Map<string, number>();

let sweepTimer: ReturnType<typeof setInterval> | null = null;

function ensureSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    let purged = 0;
    for (const [id, expiresAt] of seen) {
      if (now >= expiresAt) {
        seen.delete(id);
        purged++;
      }
    }
    if (purged > 0) {
      log.debug('Dedup sweep', { purged, remaining: seen.size });
    }
  }, SWEEP_INTERVAL_MS);

  // Don't keep the process alive just for sweeping
  if (typeof sweepTimer === 'object' && 'unref' in sweepTimer) {
    sweepTimer.unref();
  }
}

/**
 * Check whether we've already seen this message ID.
 * Returns `true` if the message is a **duplicate** (should be skipped).
 * Returns `false` the first time we see it (should be processed).
 */
export function isDuplicate(messageId: string | undefined | null, ttlMs = DEFAULT_TTL_MS): boolean {
  if (!messageId) return false; // no ID → can't dedup, allow through

  const now = Date.now();

  // Already seen and not expired?
  const expiresAt = seen.get(messageId);
  if (expiresAt !== undefined && now < expiresAt) {
    log.info('Duplicate message detected — skipping', { messageId });
    return true;
  }

  // First time — record and allow
  seen.set(messageId, now + ttlMs);
  ensureSweep();
  return false;
}

/** Visible for testing. */
export function _resetForTest(): void {
  seen.clear();
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
