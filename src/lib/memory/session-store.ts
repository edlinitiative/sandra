import type { ChatMessage } from '@/lib/ai/types';
import type { Session, Message } from '@prisma/client';
import type { SessionMemoryStore, ISessionStore, ConversationEntry } from './types';
import { MAX_CONTEXT_MESSAGES } from '@/lib/config';
import { createLogger } from '@/lib/utils';
import { db } from '@/lib/db';
import {
  createSession as dbCreateSession,
  getSessionById,
  updateSession as dbUpdateSession,
} from '@/lib/db/sessions';
import {
  createMessage as dbCreateMessage,
  getMessagesBySessionId,
} from '@/lib/db/messages';
import type { MessageRole } from '@prisma/client';
import { PrismaSessionStore as PrismaSessionMemoryStore } from './prisma-session-store';

const log = createLogger('memory:session');

// ── In-Memory Session Store (for tests only) ─────────────────────────────────

/**
 * In-memory session store.
 * Used only in tests or when DATABASE_URL is not configured.
 */
export class InMemorySessionStore implements SessionMemoryStore {
  private store = new Map<string, ConversationEntry[]>();

  async getHistory(sessionId: string, limit?: number): Promise<ConversationEntry[]> {
    const entries = this.store.get(sessionId) ?? [];
    if (limit) return entries.slice(-limit);
    return entries;
  }

  async addEntry(sessionId: string, entry: ConversationEntry): Promise<void> {
    const entries = this.store.get(sessionId) ?? [];
    entries.push(entry);
    this.store.set(sessionId, entries);
    log.debug(`Added entry to session ${sessionId}`, { role: entry.role });
  }

  async getContextMessages(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    const max = limit ?? MAX_CONTEXT_MESSAGES;
    const entries = await this.getHistory(sessionId, max);
    return entries.map((e) => ({
      role: e.role,
      content: e.content,
    }));
  }

  async clear(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
    log.debug(`Cleared session memory: ${sessionId}`);
  }
}

// Singleton for the session store
let sessionStore: SessionMemoryStore | null = null;

/**
 * Get the session memory store singleton.
 * Prefers PrismaSessionStore (DB-backed, persistent) when DATABASE_URL is set.
 * Falls back to InMemorySessionStore for tests.
 */
export function getSessionStore(): SessionMemoryStore {
  if (!sessionStore) {
    if (process.env.DATABASE_URL) {
      log.info('Initializing PrismaSessionStore (DB-backed, persistent)');
      sessionStore = new PrismaSessionMemoryStore(db);
    } else {
      log.info('Initializing InMemorySessionStore (volatile, no DATABASE_URL)');
      sessionStore = new InMemorySessionStore();
    }
  }
  return sessionStore;
}

export function setSessionStore(store: SessionMemoryStore): void {
  sessionStore = store;
}

// ── Prisma-backed Session Store (DB persistence) ─────────────────────────────

/**
 * DB-backed session store.
 * Persists sessions and messages to PostgreSQL via Prisma.
 */
export class PrismaSessionStore implements ISessionStore {
  async createSession(params: {
    id?: string;
    channel?: string;
    language?: string;
    userId?: string;
    title?: string;
  }): Promise<Session> {
    const session = await dbCreateSession(db, {
      id: params.id,
      channel: params.channel ?? 'web',
      language: params.language ?? 'en',
      userId: params.userId,
      title: params.title,
    });
    log.info(`Created session: ${session.id}`, { channel: session.channel, language: session.language });
    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return getSessionById(db, sessionId);
  }

  async updateSession(
    sessionId: string,
    updates: {
      title?: string;
      language?: string;
      isActive?: boolean;
      userId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Session> {
    const session = await dbUpdateSession(db, sessionId, updates);
    log.info(`Updated session: ${sessionId}`, updates);
    return session;
  }

  async addMessage(params: {
    sessionId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    language?: string;
    toolName?: string;
    toolCallId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Message> {
    await this.ensureSessionExists(params.sessionId, params.language);

    const message = await dbCreateMessage(db, {
      sessionId: params.sessionId,
      role: params.role as MessageRole,
      content: params.content,
      language: params.language,
      toolName: params.toolName,
      toolCallId: params.toolCallId,
      metadata: params.metadata,
    });
    log.debug(`Added message to session ${params.sessionId}`, { role: params.role });
    return message;
  }

  async getMessages(
    sessionId: string,
    options?: { limit?: number; order?: 'asc' | 'desc' },
  ): Promise<Message[]> {
    return getMessagesBySessionId(db, sessionId, {
      limit: options?.limit,
      orderBy: options?.order ?? 'asc',
    });
  }

  async loadContext(sessionId: string, maxMessages?: number): Promise<ChatMessage[]> {
    const limit = maxMessages ?? MAX_CONTEXT_MESSAGES;

    // Get last N messages ordered by createdAt DESC, then reverse for chronological order
    const messages = await getMessagesBySessionId(db, sessionId, {
      limit,
      orderBy: 'desc',
    });

    // Reverse to get chronological order (oldest first)
    messages.reverse();

    return messages.map((msg): ChatMessage => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content,
          toolCallId: msg.toolCallId ?? undefined,
          name: msg.toolName ?? undefined,
        };
      }
      return {
        role: msg.role as ChatMessage['role'],
        content: msg.content,
      };
    });
  }

  private async ensureSessionExists(sessionId: string, language?: string): Promise<void> {
    await db.session.upsert({
      where: { id: sessionId },
      update: {
        ...(language ? { language } : {}),
      },
      create: {
        id: sessionId,
        channel: 'web',
        language: language ?? 'en',
      },
    });
  }
}

// Singleton for the Prisma session store
let prismaSessionStore: PrismaSessionStore | null = null;

export function getPrismaSessionStore(): PrismaSessionStore {
  if (!prismaSessionStore) {
    prismaSessionStore = new PrismaSessionStore();
  }
  return prismaSessionStore;
}
