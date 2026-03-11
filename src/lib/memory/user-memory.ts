import type { UserMemoryStore, UserMemoryEntry } from './types';
import { createLogger } from '@/lib/utils';

const log = createLogger('memory:user');

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
