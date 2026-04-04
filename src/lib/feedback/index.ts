/**
 * Response feedback service.
 *
 * Users can rate Sandra's responses as helpful (👍) or not helpful (👎).
 * Ratings are stored in the MessageFeedback table and tracked as analytics
 * events so Sandra's satisfaction rate is visible in reporting.
 *
 * Future: ratings linked to the retrieved document chunks that supported a
 * response can boost or demote those chunks in future retrieval — closing
 * the learning loop. Infrastructure for that (messageRef, sessionId) is
 * already captured here.
 */

import { z } from 'zod';
import { db } from '@/lib/db';
import { trackEvent } from '@/lib/analytics';
import { createLogger } from '@/lib/utils';

const log = createLogger('feedback');

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const submitFeedbackSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  messageRef: z.string().min(1).describe('Client-assigned UUID for the response message'),
  rating: z.enum(['up', 'down']),
  comment: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SubmitFeedbackParams = z.infer<typeof submitFeedbackSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FeedbackStats {
  total: number;
  positive: number;
  negative: number;
  /** Fraction 0–1, or null when no data */
  satisfactionRate: number | null;
  /** Up to 10 most recent negative responses with their comments */
  recentNegative: Array<{
    sessionId: string;
    comment: string | null;
    createdAt: Date;
  }>;
  period: { from: Date; to: Date };
}

// ─── submitFeedback ───────────────────────────────────────────────────────────

/**
 * Record a user rating for a response.
 * Writes to MessageFeedback and fires a response_feedback analytics event.
 */
export async function submitFeedback(params: SubmitFeedbackParams): Promise<void> {
  const parsed = submitFeedbackSchema.parse(params);

  // Prevent duplicate votes on the same message in the same session
  const existing = await (db as unknown as {
    messageFeedback: {
      findFirst: (args: {
        where: { sessionId: string; messageRef: string };
        select: { id: boolean };
      }) => Promise<{ id: string } | null>;
      create: (args: {
        data: {
          sessionId: string;
          userId?: string;
          messageRef: string;
          rating: string;
          comment?: string;
          metadata?: Record<string, unknown>;
        };
      }) => Promise<unknown>;
    };
  }).messageFeedback.findFirst({
    where: { sessionId: parsed.sessionId, messageRef: parsed.messageRef },
    select: { id: true },
  });

  if (existing) {
    log.debug('Duplicate feedback ignored', { sessionId: parsed.sessionId, messageRef: parsed.messageRef });
    return;
  }

  await (db as unknown as {
    messageFeedback: {
      create: (args: {
        data: {
          sessionId: string;
          userId?: string;
          messageRef: string;
          rating: string;
          comment?: string;
          metadata?: Record<string, unknown>;
        };
      }) => Promise<unknown>;
    };
  }).messageFeedback.create({
    data: {
      sessionId: parsed.sessionId,
      userId: parsed.userId,
      messageRef: parsed.messageRef,
      rating: parsed.rating,
      comment: parsed.comment,
      metadata: (parsed.metadata ?? {}) as Record<string, unknown>,
    },
  });

  trackEvent({
    eventType: 'response_feedback',
    sessionId: parsed.sessionId,
    userId: parsed.userId,
    data: {
      rating: parsed.rating,
      hasComment: !!parsed.comment,
      messageRef: parsed.messageRef,
    },
  });

  log.info('Feedback recorded', { sessionId: parsed.sessionId, rating: parsed.rating });
}

// ─── getFeedbackStats ─────────────────────────────────────────────────────────

/**
 * Aggregate satisfaction stats for a time window.
 * Defaults to the last 7 days.
 */
export async function getFeedbackStats(
  fromDate?: Date,
  toDate?: Date,
): Promise<FeedbackStats> {
  const to = toDate ?? new Date();
  const from = fromDate ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  type FeedbackRecord = { id: string };
  type NegativeRecord = { sessionId: string; comment: string | null; createdAt: Date };

  const [total, positive, recentNegative] = await Promise.all([
    (db as unknown as {
      messageFeedback: {
        count: (args: { where: { createdAt: { gte: Date; lte: Date } } }) => Promise<number>;
      };
    }).messageFeedback.count({
      where: { createdAt: { gte: from, lte: to } },
    }),

    (db as unknown as {
      messageFeedback: {
        count: (args: { where: { rating: string; createdAt: { gte: Date; lte: Date } } }) => Promise<number>;
      };
    }).messageFeedback.count({
      where: { rating: 'up', createdAt: { gte: from, lte: to } },
    }),

    (db as unknown as {
      messageFeedback: {
        findMany: (args: {
          where: { rating: string; createdAt: { gte: Date; lte: Date } };
          select: { sessionId: boolean; comment: boolean; createdAt: boolean };
          orderBy: { createdAt: 'desc' };
          take: number;
        }) => Promise<NegativeRecord[]>;
      };
    }).messageFeedback.findMany({
      where: { rating: 'down', createdAt: { gte: from, lte: to } },
      select: { sessionId: true, comment: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const negative = total - positive;
  const satisfactionRate = total === 0 ? null : Math.round((positive / total) * 100) / 100;

  return { total, positive, negative, satisfactionRate, recentNegative, period: { from, to } };
}
