import type { ChatMessage } from '@/lib/ai/types';
import type { SessionMemoryStore, ConversationEntry } from './types';
import { MAX_CONTEXT_MESSAGES } from '@/lib/config';
import { createLogger } from '@/lib/utils';

const log = createLogger('memory:session');

/**
 * In-memory session store.
 * Production replacement: backed by Redis or Postgres.
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

// Singleton for the default session store
let sessionStore: SessionMemoryStore | null = null;

export function getSessionStore(): SessionMemoryStore {
  if (!sessionStore) {
    sessionStore = new InMemorySessionStore();
  }
  return sessionStore;
}

export function setSessionStore(store: SessionMemoryStore): void {
  sessionStore = store;
}
