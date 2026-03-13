import type { UserMemoryStore, UserMemoryEntry } from './types';
import { createLogger } from '@/lib/utils';
import { db } from '@/lib/db';

const log = createLogger('memory:user');

// ── In-Memory User Memory Store ───────────────────────────────────────────────

/**
 * In-memory user memory store.
 * Production replacement: backed by Postgres (Memory table).
 */
export class InMemoryUserMemoryStore implements UserMemoryStore {
  private store = new Map<string, Map<string, UserMemoryEntry>>();

  private getUserMap(userId: string): Map<string, UserMemoryEntry> {
    let map = this.store.get(userId);
    if (!map) {
      map = new Map();
      this.store.set(userId, map);
    }
    return map;
  }

  async getMemories(userId: string): Promise<UserMemoryEntry[]> {
    return Array.from(this.getUserMap(userId).values());
  }

  async getMemory(userId: string, key: string): Promise<UserMemoryEntry | null> {
    return this.getUserMap(userId).get(key) ?? null;
  }

  async saveMemory(userId: string, entry: UserMemoryEntry): Promise<void> {
    this.getUserMap(userId).set(entry.key, entry);
    log.debug(`Saved user memory: ${userId}/${entry.key}`);
  }

  async deleteMemory(userId: string, key: string): Promise<void> {
    this.getUserMap(userId).delete(key);
    log.debug(`Deleted user memory: ${userId}/${key}`);
  }

  async getMemorySummary(userId: string): Promise<string> {
    const memories = await this.getMemories(userId);
    if (memories.length === 0) return '';

    const lines = memories.map((m) => `- ${m.key}: ${m.value}`);
    return `Known facts about the user:\n${lines.join('\n')}`;
  }
}

// Singleton
let userMemoryStore: UserMemoryStore | null = null;

export function getUserMemoryStore(): UserMemoryStore {
  if (!userMemoryStore) {
    userMemoryStore = new InMemoryUserMemoryStore();
  }
  return userMemoryStore;
}

export function setUserMemoryStore(store: UserMemoryStore): void {
  userMemoryStore = store;
}

// ── Session-Scoped Short-Term Memory (T033) ───────────────────────────────────

/**
 * Store a key-value fact in the Memory table for a session.
 * Uses sessionId as the namespace when no userId is available.
 *
 * Note: For anonymous sessions, the Memory.userId field stores sessionId
 * as a namespace prefix. In production, a real User record would be required.
 */
export async function setSessionMemory(
  sessionId: string,
  key: string,
  value: string,
  userId?: string,
): Promise<void> {
  const memoryUserId = userId ?? `session:${sessionId}`;
  await db.memory.upsert({
    where: {
      userId_key: { userId: memoryUserId, key },
    },
    update: {
      value,
      updatedAt: new Date(),
    },
    create: {
      userId: memoryUserId,
      key,
      value,
      source: 'conversation',
      confidence: 1.0,
    },
  });
  log.debug(`Set session memory: ${sessionId}/${key}`);
}

/**
 * Get all key-value facts stored for a session.
 */
export async function getSessionMemory(
  sessionId: string,
  userId?: string,
): Promise<Record<string, string>> {
  const memoryUserId = userId ?? `session:${sessionId}`;
  const memories = await db.memory.findMany({
    where: { userId: memoryUserId },
    orderBy: { updatedAt: 'desc' },
  });

  const result: Record<string, string> = {};
  for (const m of memories) {
    result[m.key] = m.value;
  }
  return result;
}
