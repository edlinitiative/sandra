/**
 * Group Privacy — controls for sharing private information in group chats.
 *
 * Privacy model:
 *  - By default, Sandra does NOT share info from a user's private (1:1) chats
 *    when responding in a group.
 *  - A user can explicitly grant permission by saying things like
 *    "Sandra, you can share what I told you" in a group or private chat.
 *  - Permission is stored as a Memory key: `group_sharing_consent`
 *  - The consent is user-scoped and persists across sessions.
 *
 * Group message storage:
 *  - All group messages are stored in a group session (keyed by group_id)
 *    so Sandra has full conversation context when mentioned.
 *  - Messages are attributed with the sender's name/phone for context.
 */

import { createLogger } from '@/lib/utils';
import { getPrismaSessionStore } from '@/lib/memory/session-store';
import { getUserMemoryStore } from '@/lib/memory/user-memory';

const log = createLogger('channels:group-privacy');

// ─── Memory Keys ─────────────────────────────────────────────────────────────

const SHARING_CONSENT_KEY = 'group_sharing_consent';

// ─── Sharing Consent ─────────────────────────────────────────────────────────

/**
 * Check if a user has granted permission to share their private info in groups.
 */
export async function hasGroupSharingConsent(userId: string): Promise<boolean> {
  try {
    const store = getUserMemoryStore();
    const memory = await store.getMemory(userId, SHARING_CONSENT_KEY);
    return memory?.value === 'granted';
  } catch {
    return false;
  }
}

/**
 * Grant or revoke sharing consent for a user.
 */
export async function setGroupSharingConsent(
  userId: string,
  granted: boolean,
): Promise<void> {
  const store = getUserMemoryStore();
  if (granted) {
    await store.saveMemory(userId, {
      key: SHARING_CONSENT_KEY,
      value: 'granted',
      source: 'explicit_consent',
      confidence: 1.0,
      updatedAt: new Date(),
    });
    log.info('User granted group sharing consent', { userId });
  } else {
    await store.deleteMemory(userId, SHARING_CONSENT_KEY);
    log.info('User revoked group sharing consent', { userId });
  }
}

/**
 * Get a note for the agent's context about whether the sender allows
 * sharing their private info in this group conversation.
 */
export async function getGroupSharingNote(userId: string): Promise<string> {
  const allowed = await hasGroupSharingConsent(userId);
  if (allowed) {
    return '[Privacy: This user has granted permission to share information from their private conversations in group chats.]';
  }
  return '[Privacy: Do NOT share any information from this user\'s private conversations. Only use information from this group chat and public knowledge. If asked to share private info, tell the user they can grant permission by saying "Sandra, you can share what I told you".]';
}

// ─── Group Message Storage ──────────────────────────────────────────────────

export interface StoreGroupMessageParams {
  sessionId: string;
  groupId: string;
  senderPhone: string;
  senderName: string | undefined;
  userId: string;
  content: string;
}

/**
 * Store a group message in the group session for context.
 * Messages are prefixed with sender identity so Sandra knows who said what.
 */
export async function storeGroupMessage(params: StoreGroupMessageParams): Promise<void> {
  const { sessionId, senderPhone, senderName, content } = params;

  try {
    const store = getPrismaSessionStore();
    const sender = senderName ?? `+${senderPhone.slice(0, 4)}****`;

    // Store as a user message with sender attribution in metadata
    await store.addMessage({
      sessionId,
      role: 'user',
      content: `[${sender}]: ${content}`,
      metadata: {
        senderPhone,
        senderName,
        userId: params.userId,
        groupId: params.groupId,
        isGroupMessage: true,
      },
    });

    log.debug('Stored group message', {
      sessionId,
      sender: `${senderPhone.slice(0, 4)}****`,
    });
  } catch (error) {
    log.warn('Failed to store group message', {
      error: error instanceof Error ? error.message : 'unknown',
      sessionId,
    });
  }
}
