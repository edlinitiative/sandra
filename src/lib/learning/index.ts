/**
 * learning/index.ts — Public API for Sandra's implicit learning signals.
 *
 * Exports:
 *  • detectCorrection / detectAndRecordCorrection
 *  • detectCapabilityGap / detectAndRecordCapabilityGap
 *  • getLearningSignals  (admin query)
 */

export { detectCorrection, detectAndRecordCorrection } from './correction-detector';
export type { CorrectionSignal, RecordCorrectionParams } from './correction-detector';

export { detectCapabilityGap, detectAndRecordCapabilityGap } from './capability-gap';
export type { CapabilityGapSignal, RecordCapabilityGapParams } from './capability-gap';

import { db } from '@/lib/db';

// ─── Types for admin query ────────────────────────────────────────────────────

type LearningSignalsDb = {
  knowledgeCorrection: {
    findMany: (args: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, string>;
      take?: number;
      select?: Record<string, boolean>;
    }) => Promise<unknown[]>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
  capabilityGap: {
    findMany: (args: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, string>;
      take?: number;
      select?: Record<string, boolean>;
    }) => Promise<unknown[]>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
};

// ─── Admin query ──────────────────────────────────────────────────────────────

export interface LearningSignalsResult {
  corrections: {
    unreviewed: number;
    items: unknown[];
  };
  capabilityGaps: {
    unreviewed: number;
    items: unknown[];
  };
}

/**
 * Return recent unreviewed learning signals for admin review.
 * @param limit  Max items to return per signal type (default: 25)
 */
export async function getLearningSignals(limit = 25): Promise<LearningSignalsResult> {
  const typedDb = db as unknown as LearningSignalsDb;

  const [corrections, correctionCount, capabilityGaps, gapCount] = await Promise.all([
    typedDb.knowledgeCorrection.findMany({
      where: { reviewed: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    typedDb.knowledgeCorrection.count({ where: { reviewed: false } }),
    typedDb.capabilityGap.findMany({
      where: { reviewed: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    typedDb.capabilityGap.count({ where: { reviewed: false } }),
  ]);

  return {
    corrections: { unreviewed: correctionCount, items: corrections },
    capabilityGaps: { unreviewed: gapCount, items: capabilityGaps },
  };
}
