import type { Message } from '@prisma/client';
import type { SupportedLanguage } from '@/lib/i18n/types';
import { MAX_CONTEXT_MESSAGES } from '@/lib/config';
import { createLogger } from '@/lib/utils';
import { getPrismaSessionStore } from './session-store';
import { getUserMemoryStore } from './user-memory';

const log = createLogger('memory:session-insights');

const SESSION_CONTINUITY_KEY = 'continuity';
const SUMMARY_LOOKBACK_MESSAGES = MAX_CONTEXT_MESSAGES * 3;
const SUMMARY_RECENT_MESSAGES = 8;
const MAX_PROFILE_ITEMS = 4;
const MAX_SUMMARY_ITEMS = 3;
const MAX_SUMMARY_TEXT = 120;

export type SessionProfile = {
  preferredLanguage?: SupportedLanguage;
  name?: string;
  role?: string;
  interests?: string[];
  learningGoals?: string[];
};

type SessionContinuityState = {
  profile?: SessionProfile;
  conversationSummary?: string;
  updatedAt?: string;
};

type SessionMetadataRecord = Record<string, unknown>;

type ContextResult = {
  memorySummary: string;
  conversationSummary: string;
};

export async function getSessionContinuityContext(params: {
  sessionId: string;
  userId?: string;
}): Promise<ContextResult> {
  const store = getPrismaSessionStore();
  const [session, userMemorySummary] = await Promise.all([
    store.getSession(params.sessionId).catch(() => null),
    params.userId
      ? getUserMemoryStore().getMemorySummary(params.userId).catch(() => '')
      : Promise.resolve(''),
  ]);

  const continuity = readSessionContinuity(session?.metadata);
  const sessionMemorySummary = formatSessionProfileSummary(continuity.profile);

  return {
    memorySummary: [sessionMemorySummary, userMemorySummary].filter(Boolean).join('\n\n'),
    conversationSummary: continuity.conversationSummary ?? '',
  };
}

export async function rememberConversationInsights(params: {
  sessionId: string;
  userId?: string;
  language: SupportedLanguage;
  message: string;
}): Promise<void> {
  const store = getPrismaSessionStore();
  const session = await store.getSession(params.sessionId).catch(() => null);

  if (!session) {
    return;
  }

  const continuity = readSessionContinuity(session.metadata);
  const currentProfile = continuity.profile ?? {};
  const extractedProfile = extractSessionProfile(params.message, params.language);
  const nextProfile = mergeSessionProfiles(currentProfile, extractedProfile);

  if (!profilesEqual(currentProfile, nextProfile)) {
    const nextMetadata = buildSessionMetadata(session.metadata, {
      ...continuity,
      profile: nextProfile,
      updatedAt: new Date().toISOString(),
    });

    await store.updateSession(params.sessionId, { metadata: nextMetadata }).catch((error) => {
      log.warn('Failed to persist session profile insights', {
        sessionId: params.sessionId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    });
  }

  if (params.userId) {
    await persistUserInsights(params.userId, extractedProfile);
  }
}

export async function refreshConversationSummary(sessionId: string): Promise<void> {
  const store = getPrismaSessionStore();
  const session = await store.getSession(sessionId).catch(() => null);

  if (!session) {
    return;
  }

  const messages = await store.getMessages(sessionId, {
    limit: SUMMARY_LOOKBACK_MESSAGES,
    order: 'asc',
  }).catch(() => []);

  const summary = buildConversationSummary(messages);
  const continuity = readSessionContinuity(session.metadata);

  if ((continuity.conversationSummary ?? '') === summary) {
    return;
  }

  const nextMetadata = buildSessionMetadata(session.metadata, {
    ...continuity,
    conversationSummary: summary,
    updatedAt: new Date().toISOString(),
  });

  await store.updateSession(sessionId, { metadata: nextMetadata }).catch((error) => {
    log.warn('Failed to persist conversation summary', {
      sessionId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  });
}

export async function promoteSessionInsightsToUserMemory(
  sessionId: string,
  userId: string,
): Promise<void> {
  const store = getPrismaSessionStore();
  const session = await store.getSession(sessionId).catch(() => null);

  if (!session) {
    return;
  }

  const continuity = readSessionContinuity(session.metadata);
  if (!continuity.profile) {
    return;
  }

  await persistUserInsights(userId, continuity.profile);
}

export function extractSessionProfile(
  message: string,
  language: SupportedLanguage,
): Partial<SessionProfile> {
  const profile: Partial<SessionProfile> = {
    preferredLanguage: language,
  };

  const normalized = normalizeText(message);
  const nameMatch = normalized.match(
    /\b(?:my name is|call me)\s+([a-z][a-z' -]{1,40}?)(?=\s+(?:and|i am|i'm)\b|[.!?,]|$)/i,
  );
  if (nameMatch?.[1]) {
    profile.name = toTitleCase(nameMatch[1]);
  }

  const roleMatch = normalized.match(
    /\b(?:i am|i'm)\s+(?:a|an)\s+(student|teacher|educator|developer|engineer|parent|mentor|beginner)\b/i,
  );
  if (roleMatch?.[1]) {
    profile.role = roleMatch[1].toLowerCase();
  }

  const interest = extractPhrase(
    normalized,
    /\b(?:i(?:'m| am)\s+interested in|i care about)\s+([^.!?]+)/i,
  );
  if (interest) {
    profile.interests = [interest];
  }

  const learningGoal = extractPhrase(
    normalized,
    /\b(?:i want to learn|i want help with|i need help with|help me with)\s+([^.!?]+)/i,
  );
  if (learningGoal) {
    profile.learningGoals = [learningGoal];
  }

  return profile;
}

export function buildConversationSummary(
  messages: Array<Pick<Message, 'role' | 'content'>>,
): string {
  const userFacingMessages = messages.filter(
    (message) => message.role === 'user' || message.role === 'assistant',
  );

  if (userFacingMessages.length <= MAX_CONTEXT_MESSAGES) {
    return '';
  }

  const olderMessages = userFacingMessages.slice(
    0,
    Math.max(0, userFacingMessages.length - SUMMARY_RECENT_MESSAGES),
  );

  const olderUserTopics = uniqueCompact(
    olderMessages
      .filter((message) => message.role === 'user')
      .map((message) => compactText(message.content)),
    MAX_SUMMARY_ITEMS,
  );

  const olderAssistantGuidance = uniqueCompact(
    olderMessages
      .filter((message) => message.role === 'assistant')
      .map((message) => compactText(message.content)),
    MAX_SUMMARY_ITEMS,
  );

  if (olderUserTopics.length === 0 && olderAssistantGuidance.length === 0) {
    return '';
  }

  const lines = ['Earlier conversation summary:'];

  if (olderUserTopics.length > 0) {
    lines.push(`- Earlier user questions/goals: ${olderUserTopics.join(' | ')}`);
  }

  if (olderAssistantGuidance.length > 0) {
    lines.push(`- Earlier guidance already given: ${olderAssistantGuidance.join(' | ')}`);
  }

  return lines.join('\n');
}

function readSessionContinuity(metadata: unknown): SessionContinuityState {
  if (!isRecord(metadata)) {
    return {};
  }

  const rawContinuity = metadata[SESSION_CONTINUITY_KEY];
  if (!isRecord(rawContinuity)) {
    return {};
  }

  const rawProfile = isRecord(rawContinuity.profile) ? rawContinuity.profile : undefined;

  return {
    profile: rawProfile
      ? {
          preferredLanguage: asLanguage(rawProfile.preferredLanguage),
          name: asString(rawProfile.name),
          role: asString(rawProfile.role),
          interests: asStringArray(rawProfile.interests),
          learningGoals: asStringArray(rawProfile.learningGoals),
        }
      : undefined,
    conversationSummary: asString(rawContinuity.conversationSummary) ?? undefined,
    updatedAt: asString(rawContinuity.updatedAt) ?? undefined,
  };
}

function buildSessionMetadata(
  existingMetadata: unknown,
  continuity: SessionContinuityState,
): SessionMetadataRecord {
  const metadata = isRecord(existingMetadata) ? { ...existingMetadata } : {};
  metadata[SESSION_CONTINUITY_KEY] = {
    profile: continuity.profile,
    conversationSummary: continuity.conversationSummary,
    updatedAt: continuity.updatedAt,
  };
  return metadata;
}

function formatSessionProfileSummary(profile?: SessionProfile): string {
  if (!profile) {
    return '';
  }

  const lines: string[] = [];
  if (profile.preferredLanguage) {
    lines.push(`- Preferred language: ${profile.preferredLanguage}`);
  }
  if (profile.name) {
    lines.push(`- Name: ${profile.name}`);
  }
  if (profile.role) {
    lines.push(`- Role: ${profile.role}`);
  }
  if (profile.interests?.length) {
    lines.push(`- Interests: ${profile.interests.join(', ')}`);
  }
  if (profile.learningGoals?.length) {
    lines.push(`- Learning goals: ${profile.learningGoals.join(', ')}`);
  }

  if (lines.length === 0) {
    return '';
  }

  return `Known facts from this session:\n${lines.join('\n')}`;
}

async function persistUserInsights(
  userId: string,
  profile: Partial<SessionProfile>,
): Promise<void> {
  const userMemoryStore = getUserMemoryStore();
  const entries: Array<{ key: string; value: string }> = [];

  if (profile.preferredLanguage) {
    entries.push({ key: 'preferred_language', value: profile.preferredLanguage });
  }
  if (profile.name) {
    entries.push({ key: 'name', value: profile.name });
  }
  if (profile.role) {
    entries.push({ key: 'role', value: profile.role });
  }
  if (profile.interests?.length) {
    entries.push({ key: 'interests', value: profile.interests.join(', ') });
  }
  if (profile.learningGoals?.length) {
    entries.push({ key: 'learning_goals', value: profile.learningGoals.join(', ') });
  }

  await Promise.all(
    entries.map((entry) =>
      userMemoryStore.saveMemory(userId, {
        key: entry.key,
        value: entry.value,
        source: 'conversation',
        confidence: 0.8,
        updatedAt: new Date(),
      }),
    ),
  ).catch((error) => {
    log.warn('Failed to persist user insights', {
      userId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  });
}

function mergeSessionProfiles(
  currentProfile: SessionProfile,
  extractedProfile: Partial<SessionProfile>,
): SessionProfile {
  return {
    preferredLanguage: extractedProfile.preferredLanguage ?? currentProfile.preferredLanguage,
    name: extractedProfile.name ?? currentProfile.name,
    role: extractedProfile.role ?? currentProfile.role,
    interests: mergeList(currentProfile.interests, extractedProfile.interests),
    learningGoals: mergeList(currentProfile.learningGoals, extractedProfile.learningGoals),
  };
}

function profilesEqual(left?: SessionProfile, right?: SessionProfile): boolean {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

function mergeList(
  currentValues?: string[],
  nextValues?: string[],
): string[] | undefined {
  const merged = [...(currentValues ?? []), ...(nextValues ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);

  if (merged.length === 0) {
    return undefined;
  }

  return Array.from(new Set(merged)).slice(0, MAX_PROFILE_ITEMS);
}

function extractPhrase(
  message: string,
  pattern: RegExp,
): string | undefined {
  const match = message.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  return compactText(match[1])
    .replace(/^(to\s+)/i, '')
    .replace(/\s+(please|thanks?)$/i, '')
    .trim();
}

function uniqueCompact(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function compactText(value: string): string {
  const normalized = normalizeText(value).replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_SUMMARY_TEXT) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_SUMMARY_TEXT - 3).trim()}...`;
}

function normalizeText(value: string): string {
  return value.replace(/[*_`>#-]/g, ' ');
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asLanguage(value: unknown): SupportedLanguage | undefined {
  return value === 'en' || value === 'fr' || value === 'ht' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return items.length > 0 ? items : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
