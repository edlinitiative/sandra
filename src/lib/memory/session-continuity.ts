import type { ChannelType } from '@/lib/channels/types';
import type { SupportedLanguage } from '@/lib/i18n/types';
import { createLogger } from '@/lib/utils';
import { getPrismaSessionStore } from './session-store';

const log = createLogger('memory:continuity');

export async function getSessionLanguage(sessionId?: string): Promise<string | undefined> {
  if (!sessionId) {
    return undefined;
  }

  try {
    const store = getPrismaSessionStore();
    const session = await store.getSession(sessionId);
    return session?.language ?? undefined;
  } catch (error) {
    log.warn('Failed to load session language', {
      sessionId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return undefined;
  }
}

export async function ensureSessionContinuity(params: {
  sessionId: string;
  channel: ChannelType;
  language: SupportedLanguage;
  userId?: string;
}): Promise<void> {
  const store = getPrismaSessionStore();

  try {
    const existing = await store.getSession(params.sessionId);

    if (!existing) {
      await store.createSession({
        id: params.sessionId,
        channel: params.channel,
        language: params.language,
        userId: params.userId,
      });
      return;
    }

    const updates: {
      language?: SupportedLanguage;
      userId?: string;
    } = {};

    if (existing.language !== params.language) {
      updates.language = params.language;
    }

    if (params.userId && existing.userId !== params.userId) {
      updates.userId = params.userId;
    }

    if (Object.keys(updates).length > 0) {
      await store.updateSession(params.sessionId, updates);
    }
  } catch (error) {
    log.warn('Failed to ensure session continuity metadata', {
      sessionId: params.sessionId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/**
 * Get or create a session for an inbound channel message.
 *
 * Uses a deterministic sessionId (`{channel}:{channelUserId}`) so that repeated
 * messages from the same phone number / user always resolve to the same session,
 * providing cross-message conversation continuity.
 */
export async function getOrCreateSessionForChannel(params: {
  channel: ChannelType;
  channelUserId: string;
  userId?: string;
}): Promise<{ sessionId: string; userId?: string; language: SupportedLanguage }> {
  const sessionId = `${params.channel}:${params.channelUserId}`;
  const store = getPrismaSessionStore();

  try {
    const existing = await store.getSession(sessionId);

    if (existing) {
      return {
        sessionId: existing.id,
        userId: existing.userId ?? params.userId,
        language: (existing.language ?? 'en') as SupportedLanguage,
      };
    }
  } catch {
    // Fall through to create
  }

  try {
    await store.createSession({
      id: sessionId,
      channel: params.channel,
      language: 'en',
      userId: params.userId,
    });
  } catch {
    // May already exist due to race — that's fine
  }

  return { sessionId, userId: params.userId, language: 'en' };
}
