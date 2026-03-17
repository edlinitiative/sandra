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
