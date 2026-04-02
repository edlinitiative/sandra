/**
 * Analytics event tracker.
 *
 * Writes AnalyticsEvent rows to the database in a fire-and-forget manner.
 * Errors are logged but never re-thrown — analytics must never break the
 * user-facing request path.
 */

import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';
import type { AnalyticsEvent } from './types';

const log = createLogger('analytics:tracker');

/**
 * Emit an analytics event.
 * Fire-and-forget — always resolves, never rejects.
 */
export function trackEvent(event: AnalyticsEvent): void {
  // Intentionally not awaited — analytics is best-effort
  void _writeEvent(event);
}

async function _writeEvent(event: AnalyticsEvent): Promise<void> {
  try {
    await (db as typeof db & {
      analyticsEvent: {
        create: (args: {
          data: {
            eventType: string;
            sessionId?: string;
            userId?: string;
            channel?: string;
            language?: string;
            data?: Record<string, unknown>;
          };
        }) => Promise<unknown>;
      };
    }).analyticsEvent.create({
      data: {
        eventType: event.eventType,
        sessionId: event.sessionId,
        userId: event.userId,
        channel: event.channel ?? ('data' in event && 'channel' in (event.data ?? {}) ? (event.data as Record<string, unknown>).channel as string : undefined),
        language: event.language ?? ('data' in event && 'language' in (event.data ?? {}) ? (event.data as Record<string, unknown>).language as string : undefined),
        data: event.data as Record<string, unknown>,
      },
    });
  } catch (error) {
    // Analytics failures must never surface to users
    log.warn('Failed to write analytics event', {
      eventType: event.eventType,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
