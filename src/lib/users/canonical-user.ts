import type { ChannelType } from '@/lib/channels/types';
import type { SupportedLanguage } from '@/lib/i18n/types';
import { isValidLanguage } from '@/lib/i18n';
import { db, getUserByExternalId, resolveUserByExternalId } from '@/lib/db';
import { promoteSessionInsightsToUserMemory } from '@/lib/memory/session-insights';
import { getPrismaSessionStore } from '@/lib/memory/session-store';
import { createLogger } from '@/lib/utils';

const log = createLogger('users:canonical');

type ResolveCanonicalUserParams = {
  sessionId?: string;
  externalUserId?: string;
  language: SupportedLanguage;
  channel: ChannelType;
};

type ResolveCanonicalUserResult = {
  userId?: string;
  externalUserId?: string;
};

export async function resolveCanonicalUser(
  params: ResolveCanonicalUserParams,
): Promise<ResolveCanonicalUserResult> {
  const normalizedExternalId = params.externalUserId?.trim() || undefined;
  const sessionStore = getPrismaSessionStore();
  const existingSession = params.sessionId
    ? await sessionStore.getSession(params.sessionId).catch(() => null)
    : null;

  if (!normalizedExternalId) {
    return {
      userId: existingSession?.userId ?? undefined,
    };
  }

  try {
    const user = await resolveUserByExternalId(db, {
      externalId: normalizedExternalId,
      language: params.language,
      channel: params.channel,
    });

    if (params.sessionId && existingSession && existingSession.userId !== user.id) {
      await promoteSessionInsightsToUserMemory(params.sessionId, user.id).catch((error) => {
        log.warn('Failed to promote session insights during user linking', {
          sessionId: params.sessionId,
          userId: user.id,
          error: error instanceof Error ? error.message : 'unknown',
        });
      });
    }

    return {
      userId: user.id,
      externalUserId: normalizedExternalId,
    };
  } catch (error) {
    log.warn('Failed to resolve canonical user', {
      sessionId: params.sessionId,
      externalUserId: normalizedExternalId,
      error: error instanceof Error ? error.message : 'unknown',
    });

    return {
      userId: existingSession?.userId ?? undefined,
      externalUserId: normalizedExternalId,
    };
  }
}

export async function getCanonicalUserLanguage(
  externalUserId?: string,
): Promise<SupportedLanguage | undefined> {
  const normalizedExternalId = externalUserId?.trim() || undefined;

  if (!normalizedExternalId) {
    return undefined;
  }

  try {
    const user = await getUserByExternalId(db, normalizedExternalId);
    return user?.language && isValidLanguage(user.language)
      ? user.language
      : undefined;
  } catch (error) {
    log.warn('Failed to load canonical user language', {
      externalUserId: normalizedExternalId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return undefined;
  }
}
