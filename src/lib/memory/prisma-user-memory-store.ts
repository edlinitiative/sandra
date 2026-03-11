import type { PrismaClient } from '@prisma/client';
import type { UserMemoryStore, UserMemoryEntry } from './types';
import { createLogger } from '@/lib/utils';

const log = createLogger('memory:prisma-user');

/**
 * Prisma-backed user memory store.
 * Persists long-term facts about users to the Memory table via PostgreSQL.
 *
 * Usage:
 *   import { db } from '@/lib/db';
 *   import { PrismaUserMemoryStore } from '@/lib/memory/prisma-user-memory-store';
 *   setUserMemoryStore(new PrismaUserMemoryStore(db));
 */
export class PrismaUserMemoryStore implements UserMemoryStore {
  constructor(private readonly prisma: PrismaClient) {}

  async getMemories(userId: string): Promise<UserMemoryEntry[]> {
    const rows = await this.prisma.memory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map(this.toEntry);
  }

  async getMemory(userId: string, key: string): Promise<UserMemoryEntry | null> {
    const row = await this.prisma.memory.findUnique({
      where: { userId_key: { userId, key } },
    });

    return row ? this.toEntry(row) : null;
  }

  async saveMemory(userId: string, entry: UserMemoryEntry): Promise<void> {
    await this.prisma.memory.upsert({
      where: { userId_key: { userId, key: entry.key } },
      create: {
        userId,
        key: entry.key,
        value: entry.value,
        source: entry.source,
        confidence: entry.confidence,
      },
      update: {
        value: entry.value,
        source: entry.source,
        confidence: entry.confidence,
      },
    });

    log.debug(`Saved user memory: ${userId}/${entry.key}`);
  }

  async deleteMemory(userId: string, key: string): Promise<void> {
    await this.prisma.memory.deleteMany({
      where: { userId, key },
    });

    log.debug(`Deleted user memory: ${userId}/${key}`);
  }

  async getMemorySummary(userId: string): Promise<string> {
    const memories = await this.getMemories(userId);
    if (memories.length === 0) return '';

    const lines = memories
      .filter((m) => m.confidence >= 0.5) // Only include confident memories
      .map((m) => `- ${m.key}: ${m.value}`);

    if (lines.length === 0) return '';
    return `Known facts about the user:\n${lines.join('\n')}`;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private toEntry(row: {
    key: string;
    value: string;
    source: string | null;
    confidence: number;
    updatedAt: Date;
  }): UserMemoryEntry {
    return {
      key: row.key,
      value: row.value,
      source: row.source ?? 'unknown',
      confidence: row.confidence,
      updatedAt: row.updatedAt,
    };
  }
}
