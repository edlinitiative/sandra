/**
 * capability-gap.ts
 *
 * Detects when a user makes an action-oriented request (send, create, schedule,
 * book, etc.) but Sandra executes zero tools — meaning Sandra couldn't fulfil it.
 *
 * How it's used:
 *   1. At the end of each agent turn, if `toolsUsed.length === 0`, the agent
 *      calls `detectAndRecordCapabilityGap()` with the original user message.
 *   2. If action patterns match, a CapabilityGap row is written.
 *   3. Admins query GET /api/learning to see the most-requested missing actions
 *      and can prioritise new tool development accordingly.
 *
 * The function is always best-effort — it never throws.
 *
 * Note: "toolsUsed.length === 0" combined with an action-signal is a conservative
 * heuristic. It will miss cases where Sandra used a tool but still couldn't complete
 * the full request, and will occasionally fire on pure knowledge questions that
 * happen to use action words. The admin review step handles triage.
 */

import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';

const log = createLogger('learning:capability-gap');

// ─── Detection patterns ───────────────────────────────────────────────────────

const CAPABILITY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Explicit can-you / could-you + action verb
  { pattern: /\b(can|could)\s+you\s+(please\s+)?(send|email|message|text|notify|alert)\b/i,        label: 'request:send_message' },
  { pattern: /\b(can|could)\s+you\s+(please\s+)?(create|make|build|generate|write|draft)\b/i,      label: 'request:create' },
  { pattern: /\b(can|could)\s+you\s+(please\s+)?(schedule|book|set\s+up|arrange|organise|organize)\b/i, label: 'request:schedule' },
  { pattern: /\b(can|could)\s+you\s+(please\s+)?(add|invite|remove|delete|update|change|edit)\b/i, label: 'request:modify' },
  { pattern: /\b(can|could)\s+you\s+(please\s+)?(find|search|look\s+up|check|fetch|get)\b/i,       label: 'request:lookup' },
  { pattern: /\b(can|could)\s+you\s+(please\s+)?(translate|convert|summarise|summarize)\b/i,       label: 'request:transform' },
  { pattern: /\b(can|could)\s+you\s+(please\s+)?(post|publish|share|upload|download)\b/i,          label: 'request:publish' },
  // Imperative please + action verb
  { pattern: /\bplease\s+(send|email|message|text|notify)\b/i,                                     label: 'imperative:send_message' },
  { pattern: /\bplease\s+(create|make|build|generate|write|draft)\b/i,                             label: 'imperative:create' },
  { pattern: /\bplease\s+(schedule|book|set\s+up|arrange)\b/i,                                     label: 'imperative:schedule' },
  { pattern: /\bplease\s+(add|invite|remove|delete|update|change|edit)\b/i,                        label: 'imperative:modify' },
  { pattern: /\bplease\s+(translate|convert|summarise|summarize)\b/i,                              label: 'imperative:transform' },
  // "I need you to" / "I want you to"
  { pattern: /\bi\s+(need|want)\s+you\s+to\s+(send|create|schedule|book|add|remove|delete|update|find|translate|post)\b/i, label: 'need:action' },
  // Direct object action requests (stronger verbs without "can you")
  { pattern: /\b(send|forward)\s+(an?\s+)?(email|message|notification|alert|reminder)\s+(to|for)\b/i, label: 'direct:send_email' },
  { pattern: /\b(schedule|book)\s+(an?\s+)?(meeting|call|appointment|event|session)\b/i,            label: 'direct:schedule_meeting' },
  { pattern: /\b(create|make|build)\s+(an?\s+)?(form|survey|spreadsheet|document|report|calendar\s+event)\b/i, label: 'direct:create_document' },
  { pattern: /\b(translate|traduis|tradwi)\b.{0,60}\b(french|english|haitian|creole|kreyòl|français)\b/i, label: 'direct:translate' },
  // French equivalents
  { pattern: /\bpeux[- ]tu\s+(envoyer|créer|programmer|traduire|ajouter|supprimer)\b/i,            label: 'fr:request' },
  { pattern: /\bpouvez[- ]vous\s+(envoyer|créer|programmer|traduire|ajouter|supprimer)\b/i,        label: 'fr:formal_request' },
  { pattern: /\bveuillez\s+(envoyer|créer|programmer|traduire|ajouter)\b/i,                        label: 'fr:imperative' },
  // Haitian Creole equivalents
  { pattern: /\beske\s+ou\s+(ka|kapab)\s+(voye|kreye|f[eè]|jwenn|tradwi)/i,                       label: 'ht:request' },
  { pattern: /\bsil\s+ou\s+pl[eè]\s+(voye|kreye|f[eè]|jwenn)/i,                                   label: 'ht:imperative' },
];

const MAX_MESSAGE_LENGTH = 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CapabilityGapSignal {
  isCapabilityGap: boolean;
  matchedPatterns: string[];
}

export interface RecordCapabilityGapParams {
  sessionId: string;
  userId?: string;
  channel?: string;
  language?: string;
  message: string;
}

// ─── Detection (pure, synchronous) ───────────────────────────────────────────

/**
 * Test whether a message contains an action-oriented request.
 * Pure function — no side effects, safe to call anywhere.
 */
export function detectCapabilityGap(message: string): CapabilityGapSignal {
  const matched: string[] = [];
  for (const { pattern, label } of CAPABILITY_PATTERNS) {
    if (pattern.test(message)) {
      matched.push(label);
    }
  }
  return { isCapabilityGap: matched.length > 0, matchedPatterns: matched };
}

// ─── Recording ───────────────────────────────────────────────────────────────

type CapabilityGapDb = {
  capabilityGap: {
    create: (args: {
      data: {
        sessionId: string;
        userId?: string;
        channel?: string;
        language?: string;
        userMessage: string;
        patterns: string[];
      };
    }) => Promise<unknown>;
  };
};

/**
 * Detect and record a capability gap signal.
 * No-op when the message is not action-oriented.
 * Always resolves — never throws.
 */
export async function detectAndRecordCapabilityGap(params: RecordCapabilityGapParams): Promise<void> {
  try {
    const signal = detectCapabilityGap(params.message);
    if (!signal.isCapabilityGap) return;

    await (db as unknown as CapabilityGapDb).capabilityGap.create({
      data: {
        sessionId: params.sessionId,
        userId: params.userId,
        channel: params.channel,
        language: params.language,
        userMessage: params.message.slice(0, MAX_MESSAGE_LENGTH),
        patterns: signal.matchedPatterns,
      },
    });

    log.info('Capability gap recorded', {
      sessionId: params.sessionId,
      patterns: signal.matchedPatterns,
    });
  } catch (error) {
    log.warn('Failed to record capability gap', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
