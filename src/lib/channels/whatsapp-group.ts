/**
 * WhatsApp Group Chat support.
 *
 * Handles:
 *  - Detecting group vs 1:1 messages from webhook payloads
 *  - Mention detection ("Sandra", "@Sandra", etc.)
 *  - Group session management (keyed by group_id)
 *  - Privacy controls for cross-context info sharing
 */

import { APP_NAME } from '@/lib/config/constants';
import { createLogger } from '@/lib/utils';

const log = createLogger('channels:whatsapp-group');

// ─── Mention Detection ──────────────────────────────────────────────────────

/** Agent name used for mention detection, lowercased. */
const AGENT_NAME = APP_NAME.toLowerCase();

/**
 * Names/aliases that trigger the agent to respond in a group chat.
 * Built dynamically from APP_NAME so any deployment works.
 */
const MENTION_TRIGGERS = [
  AGENT_NAME,
  `@${AGENT_NAME}`,
  `hey ${AGENT_NAME}`,
  `hi ${AGENT_NAME}`,
  `ok ${AGENT_NAME}`,
  `okay ${AGENT_NAME}`,
  `yo ${AGENT_NAME}`,
  `dear ${AGENT_NAME}`,
];

/**
 * Check whether a message mentions Sandra (case-insensitive).
 *
 * Strategy: look for any mention trigger as a standalone word/phrase.
 * Handles punctuation (e.g., "Sandra!" or "Sandra,").
 */
export function isSandraMentioned(text: string): boolean {
  if (!text) return false;

  const normalised = text.toLowerCase().trim();

  for (const trigger of MENTION_TRIGGERS) {
    // Build a regex that matches the trigger as a word boundary
    // Allows punctuation after the trigger (e.g., "Sandra!" "Sandra," "Sandra?")
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s|,)${escaped}(?:[\\s,!?.;:]|$)`, 'i');
    if (regex.test(normalised)) return true;
  }

  // Also match if the entire message is just the agent name with optional punctuation
  const nameEscaped = AGENT_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^@?${nameEscaped}[!?.,:;]*$`, 'i').test(normalised)) return true;

  return false;
}

/**
 * Strip the mention trigger from the message text so the agent gets a clean query.
 * e.g., "@Sandra what's the ESLP schedule?" → "what's the ESLP schedule?"
 */
export function stripMention(text: string): string {
  if (!text) return text;

  // Remove leading mentions dynamically based on APP_NAME
  const escaped = AGENT_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^(?:@${escaped}|hey\\s+${escaped}|hi\\s+${escaped}|ok(?:ay)?\\s+${escaped}|yo\\s+${escaped}|dear\\s+${escaped}|${escaped})[,!?.;:\\s]*`, 'i');
  let cleaned = text.replace(pattern, '').trim();

  // If stripping emptied the message, return original (they just said "Sandra")
  if (!cleaned) cleaned = text;

  return cleaned;
}

// ─── Group Context ──────────────────────────────────────────────────────────

/**
 * Format context about who sent a message in a group,
 * so Sandra's agent knows the sender's identity.
 */
export function formatGroupContext(
  senderName: string | undefined,
  senderPhone: string,
  groupId: string,
): string {
  const sender = senderName ?? `+${senderPhone.slice(0, 4)}****`;
  return `[Group chat — sender: ${sender}]`;
}

/**
 * Build a deterministic session ID for a WhatsApp group.
 * Different from 1:1 sessions which use `whatsapp:{phone}`.
 */
export function buildGroupSessionId(groupId: string): string {
  return `whatsapp-group:${groupId}`;
}

// ─── Reply Detection ─────────────────────────────────────────────────────────

/**
 * Check whether a group message is a reply to a message Sandra sent.
 *
 * WhatsApp includes `context.from` (the phone number of the original sender)
 * when someone replies to a specific message. If that matches Sandra's business
 * phone number, the user is replying directly to Sandra.
 */
export function isReplyToSandra(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) return false;

  const contextFrom = metadata.contextFrom as string | null | undefined;
  const businessPhone = metadata.businessPhoneNumber as string | null | undefined;

  if (!contextFrom || !businessPhone) return false;

  // Normalize to digits-only for comparison
  const normContext = contextFrom.replace(/[^\d]/g, '');
  const normBusiness = businessPhone.replace(/[^\d]/g, '');

  if (!normContext || !normBusiness) return false;

  // Exact or suffix match (handles country code differences)
  return normContext === normBusiness
    || normContext.endsWith(normBusiness)
    || normBusiness.endsWith(normContext);
}

log.info('WhatsApp group chat module loaded');
