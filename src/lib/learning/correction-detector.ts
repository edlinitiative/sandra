/**
 * correction-detector.ts
 *
 * Detects when a user is correcting a prior Sandra response and records
 * the signal for admin review.
 *
 * How it's used:
 *   1. After each user message, `detectAndRecordCorrection()` is called
 *      with the message and the last assistant response.
 *   2. If correction patterns match, a KnowledgeCorrection row is written.
 *   3. Admins query GET /api/learning to see unreviewed corrections and
 *      can update the knowledge base or fix retrieval gaps accordingly.
 *
 * The function is always best-effort — it never throws.
 */

import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';

const log = createLogger('learning:correction');

// ─── Detection patterns ───────────────────────────────────────────────────────

const CORRECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // ── English ────────────────────────────────────────────────────────────────
  { pattern: /\bthat'?s?\s+(not\s+)?(wrong|incorrect|inaccurate|false|not right|untrue)\b/i,     label: 'en:thats_wrong' },
  { pattern: /\byou'?re?\s+(wrong|incorrect|mistaken)\b/i,                                        label: 'en:youre_wrong' },
  { pattern: /\bactually[,\s]+(it'?s|that'?s|the\s+|no\b)/i,                                     label: 'en:actually' },
  { pattern: /\bno[,\s]+(that'?s|it'?s|actually|the\s+correct)\b/i,                              label: 'en:no_thats' },
  { pattern: /\bthat\s+(information\s+)?(is\s+)?(wrong|incorrect|inaccurate|false)\b/i,           label: 'en:that_info_wrong' },
  { pattern: /\bnot\s+quite\s+right\b/i,                                                          label: 'en:not_quite_right' },
  { pattern: /\bthat'?s?\s+not\s+(accurate|correct|right)\b/i,                                   label: 'en:thats_not_accurate' },
  { pattern: /\bi\s+think\s+you('?re|\s+are)\s+(wrong|mistaken|incorrect)\b/i,                   label: 'en:i_think_wrong' },
  { pattern: /\bthe\s+(correct|right)\s+answer\s+is\b/i,                                         label: 'en:correct_answer_is' },
  // ── French ─────────────────────────────────────────────────────────────────
  { pattern: /\bc'est\s+(faux|incorrect|inexact|pas\s+(correct|exact|juste|vrai))\b/i,            label: 'fr:cest_faux' },
  { pattern: /\b(tu\s+as|vous\s+avez)\s+tort\b/i,                                                label: 'fr:tu_as_tort' },
  { pattern: /\ben\s+fait[,\s]/i,                                                                 label: 'fr:en_fait' },
  { pattern: /\bnon[,\s]+(c'est|en\s+fait|la\s+r[eé]ponse)\b/i,                                  label: 'fr:non_cest' },
  { pattern: /\bcette?\s+(information\s+est|r[eé]ponse\s+est)\s+(fausse?|incorrecte?|inexacte?)\b/i, label: 'fr:info_fausse' },
  { pattern: /\bce\s+n'est\s+pas\s+(correct|exact|juste|vrai)\b/i,                               label: 'fr:ce_nest_pas_correct' },
  // ── Haitian Creole ─────────────────────────────────────────────────────────
  { pattern: /\bsa\s+pa\s+(bon|kòrèk|egzak|vre|jis)\b/i,                                        label: 'ht:sa_pa_bon' },
  { pattern: /\bou\s+pa\s+gen\s+rezon\b/i,                                                       label: 'ht:ou_pa_gen_rezon' },
  { pattern: /\ban\s+reyalite\b/i,                                                                label: 'ht:an_reyalite' },
  { pattern: /\bsa\s+se\s+pa\s+(vre|egzak)\b/i,                                                  label: 'ht:sa_se_pa_vre' },
];

const MAX_RESPONSE_SNIPPET = 500;
const MAX_MESSAGE_LENGTH = 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorrectionSignal {
  isCorrection: boolean;
  matchedPatterns: string[];
}

export interface RecordCorrectionParams {
  sessionId: string;
  userId?: string;
  language?: string;
  message: string;
  /** The last assistant response (will be truncated to 500 chars) */
  priorResponse?: string;
}

// ─── Detection (pure, synchronous) ───────────────────────────────────────────

/**
 * Test whether a user message is correcting a prior response.
 * Pure function — no side effects, safe to call anywhere.
 */
export function detectCorrection(message: string): CorrectionSignal {
  const matched: string[] = [];
  for (const { pattern, label } of CORRECTION_PATTERNS) {
    if (pattern.test(message)) {
      matched.push(label);
    }
  }
  return { isCorrection: matched.length > 0, matchedPatterns: matched };
}

// ─── Recording ───────────────────────────────────────────────────────────────

type CorrectionDb = {
  knowledgeCorrection: {
    create: (args: {
      data: {
        sessionId: string;
        userId?: string;
        language?: string;
        userMessage: string;
        priorResponse?: string;
        patterns: string[];
      };
    }) => Promise<unknown>;
  };
};

/**
 * Detect and record a correction signal.
 * No-op when the message is not a correction.
 * Always resolves — never throws.
 */
export async function detectAndRecordCorrection(params: RecordCorrectionParams): Promise<void> {
  try {
    const signal = detectCorrection(params.message);
    if (!signal.isCorrection) return;

    await (db as unknown as CorrectionDb).knowledgeCorrection.create({
      data: {
        sessionId: params.sessionId,
        userId: params.userId,
        language: params.language,
        userMessage: params.message.slice(0, MAX_MESSAGE_LENGTH),
        priorResponse: params.priorResponse
          ? params.priorResponse.slice(0, MAX_RESPONSE_SNIPPET)
          : undefined,
        patterns: signal.matchedPatterns,
      },
    });

    log.info('Correction signal recorded', {
      sessionId: params.sessionId,
      patterns: signal.matchedPatterns,
    });
  } catch (error) {
    log.warn('Failed to record correction signal', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
