import type { PrismaClient, Prisma } from '@prisma/client';
import type { ChatMessage } from '@/lib/ai/types';
import type { SessionMemoryStore, ConversationEntry } from './types';
import { MAX_CONTEXT_MESSAGES } from '@/lib/config';
import { createLogger } from '@/lib/utils';

const log = createLogger('memory:prisma-session');

/**
 * Prisma-backed session memory store.
 * Persists conversation history to the Message table via PostgreSQL.
 *
 * Usage:
 *   import { db } from '@/lib/db';
 *   import { PrismaSessionStore } from '@/lib/memory/prisma-session-store';
 *   setSessionStore(new PrismaSessionStore(db));
 */
export class PrismaSessionStore implements SessionMemoryStore {
  constructor(private readonly prisma: PrismaClient) {}

  async getHistory(sessionId: string, limit?: number): Promise<ConversationEntry[]> {
    // Ensure the session exists
    await this.ensureSession(sessionId);

    const messages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      ...(limit ? { take: limit, skip: undefined } : {}),
    });

    // If we need the *last N*, we must fetch desc then reverse
    if (limit && messages.length > limit) {
      return messages.slice(-limit).map(this.toEntry);
    }

    return messages.map(this.toEntry);
  }

  async addEntry(sessionId: string, entry: ConversationEntry): Promise<void> {
    await this.ensureSession(sessionId);

    await this.prisma.message.create({
      data: {
        sessionId,
        role: entry.role,
        content: entry.content,
        language: (entry.metadata?.['language'] as string) ?? undefined,
        toolName: (entry.metadata?.['toolName'] as string) ?? undefined,
        toolCallId: (entry.metadata?.['toolCallId'] as string) ?? undefined,
        metadata: entry.metadata
          ? (entry.metadata as Prisma.InputJsonValue)
          : undefined,
        createdAt: entry.timestamp,
      },
    });

    // Update session last-active timestamp
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    log.debug(`Persisted entry to session ${sessionId}`, { role: entry.role });
  }

  async getContextMessages(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    const max = limit ?? MAX_CONTEXT_MESSAGES;

    const messages = await this.prisma.message.findMany({
      where: {
        sessionId,
        role: { in: ['user', 'assistant', 'system', 'tool'] },
      },
      orderBy: { createdAt: 'desc' },
      take: max,
      select: { role: true, content: true },
    });

    // Reverse to get chronological order
    return messages.reverse().map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }));
  }

  async clear(sessionId: string): Promise<void> {
    await this.prisma.message.deleteMany({ where: { sessionId } });
    log.debug(`Cleared session memory: ${sessionId}`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private toEntry(msg: { role: string; content: string; createdAt: Date; metadata: unknown }): ConversationEntry {
    return {
      role: msg.role as ConversationEntry['role'],
      content: msg.content,
      timestamp: msg.createdAt,
      metadata: (msg.metadata as Record<string, unknown>) ?? undefined,
    };
  }

  /**
   * Auto-create the Session row if it doesn't exist.
   * This avoids FK violations when the first message arrives
   * before an explicit session creation flow.
   */
  private async ensureSession(sessionId: string): Promise<void> {
    const existing = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.session.create({
        data: { id: sessionId },
      });
      log.debug(`Auto-created session: ${sessionId}`);
    }
  }
}
