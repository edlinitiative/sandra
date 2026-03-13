import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { mockPrismaClient, resetPrismaMocks } from '@/lib/__tests__/mocks/prisma';
import { MAX_CONTEXT_MESSAGES } from '@/lib/config';

// Mock the db module before imports that use it
vi.mock('@/lib/db', () => ({
  db: mockPrismaClient as unknown as PrismaClient,
}));

// Mock db/sessions and db/messages to use mockPrismaClient
vi.mock('@/lib/db/sessions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/sessions')>('@/lib/db/sessions');
  return actual;
});

vi.mock('@/lib/db/messages', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/messages')>('@/lib/db/messages');
  return actual;
});

import { PrismaSessionStore, InMemorySessionStore } from '../session-store';

describe('InMemorySessionStore', () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore();
  });

  describe('addEntry / getHistory', () => {
    it('stores entries and retrieves them in order', async () => {
      await store.addEntry('s1', { role: 'user', content: 'hello', timestamp: new Date() });
      await store.addEntry('s1', { role: 'assistant', content: 'hi', timestamp: new Date() });

      const history = await store.getHistory('s1');
      expect(history).toHaveLength(2);
      expect(history[0]?.role).toBe('user');
      expect(history[1]?.role).toBe('assistant');
    });

    it('returns empty array for unknown session', async () => {
      const history = await store.getHistory('unknown');
      expect(history).toEqual([]);
    });

    it('applies limit — returns last N entries', async () => {
      for (let i = 0; i < 5; i++) {
        await store.addEntry('s1', { role: 'user', content: `msg${i}`, timestamp: new Date() });
      }
      const history = await store.getHistory('s1', 3);
      expect(history).toHaveLength(3);
      expect(history[0]?.content).toBe('msg2');
    });
  });

  describe('getContextMessages', () => {
    it('maps entries to ChatMessage format', async () => {
      await store.addEntry('s1', { role: 'user', content: 'hello', timestamp: new Date() });
      await store.addEntry('s1', { role: 'assistant', content: 'hi', timestamp: new Date() });

      const messages = await store.getContextMessages('s1');
      expect(messages).toEqual([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ]);
    });

    it('defaults to MAX_CONTEXT_MESSAGES', async () => {
      for (let i = 0; i < MAX_CONTEXT_MESSAGES + 5; i++) {
        await store.addEntry('s1', { role: 'user', content: `msg${i}`, timestamp: new Date() });
      }
      const messages = await store.getContextMessages('s1');
      expect(messages).toHaveLength(MAX_CONTEXT_MESSAGES);
    });
  });

  describe('clear', () => {
    it('clears the session history', async () => {
      await store.addEntry('s1', { role: 'user', content: 'hello', timestamp: new Date() });
      await store.clear('s1');
      const history = await store.getHistory('s1');
      expect(history).toEqual([]);
    });
  });
});

describe('PrismaSessionStore', () => {
  let store: PrismaSessionStore;

  beforeEach(() => {
    resetPrismaMocks();
    store = new PrismaSessionStore();
  });

  describe('createSession', () => {
    it('creates a session with defaults', async () => {
      const mockSession = {
        id: 'cuid_123',
        channel: 'web',
        language: 'en',
        isActive: true,
        userId: null,
        title: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaClient.session.create.mockResolvedValue(mockSession);

      const session = await store.createSession({});
      expect(session.id).toBe('cuid_123');
      expect(session.channel).toBe('web');
      expect(session.language).toBe('en');
      expect(session.isActive).toBe(true);
    });

    it('passes userId when provided', async () => {
      mockPrismaClient.session.create.mockResolvedValue({ id: 'x', userId: 'user1', channel: 'web', language: 'en', isActive: true });

      await store.createSession({ userId: 'user1', channel: 'web', language: 'fr' });

      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user1', language: 'fr' }),
      });
    });
  });

  describe('getSession', () => {
    it('returns session when found', async () => {
      const mock = { id: 's1', isActive: true };
      mockPrismaClient.session.findUnique.mockResolvedValue(mock);

      const result = await store.getSession('s1');
      expect(result).toEqual(mock);
    });

    it('returns null when not found', async () => {
      mockPrismaClient.session.findUnique.mockResolvedValue(null);
      const result = await store.getSession('missing');
      expect(result).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('updates session fields', async () => {
      const updated = { id: 's1', title: 'New Title', isActive: true };
      mockPrismaClient.session.update.mockResolvedValue(updated);

      const result = await store.updateSession('s1', { title: 'New Title' });
      expect(result.title).toBe('New Title');
    });
  });

  describe('addMessage', () => {
    it('persists a message', async () => {
      const mockMsg = {
        id: 'msg1',
        sessionId: 's1',
        role: 'user',
        content: 'hello',
        language: 'en',
        toolName: null,
        toolCallId: null,
        metadata: null,
        createdAt: new Date(),
      };
      mockPrismaClient.message.create.mockResolvedValue(mockMsg);

      const msg = await store.addMessage({
        sessionId: 's1',
        role: 'user',
        content: 'hello',
        language: 'en',
      });

      expect(msg.content).toBe('hello');
      expect(msg.role).toBe('user');
      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sessionId: 's1', role: 'user', content: 'hello' }),
      });
    });

    it('stores toolName and toolCallId for tool messages', async () => {
      mockPrismaClient.message.create.mockResolvedValue({ id: 'msg2', role: 'tool' });

      await store.addMessage({
        sessionId: 's1',
        role: 'tool',
        content: '{"result": "ok"}',
        toolName: 'searchKnowledgeBase',
        toolCallId: 'call_abc',
      });

      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          toolName: 'searchKnowledgeBase',
          toolCallId: 'call_abc',
        }),
      });
    });
  });

  describe('getMessages', () => {
    it('returns messages ordered ascending by default', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([]);

      await store.getMessages('s1');

      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
      );
    });

    it('applies limit option', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([]);

      await store.getMessages('s1', { limit: 10 });

      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('loadContext', () => {
    it('returns messages in chronological order (oldest first)', async () => {
      const t1 = new Date('2024-01-01T10:00:00Z');
      const t2 = new Date('2024-01-01T10:01:00Z');
      // findMany returns DESC order (newest first)
      mockPrismaClient.message.findMany.mockResolvedValue([
        { id: 'm2', role: 'assistant', content: 'hello back', toolCallId: null, toolName: null, createdAt: t2 },
        { id: 'm1', role: 'user', content: 'hello', toolCallId: null, toolName: null, createdAt: t1 },
      ]);

      const messages = await store.loadContext('s1');

      // Should be reversed to chronological (oldest first)
      expect(messages[0]?.role).toBe('user');
      expect(messages[0]?.content).toBe('hello');
      expect(messages[1]?.role).toBe('assistant');
    });

    it('maps tool messages with toolCallId', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([
        { id: 'm1', role: 'tool', content: '{"ok":true}', toolCallId: 'call_xyz', toolName: 'searchKnowledgeBase', createdAt: new Date() },
      ]);

      const messages = await store.loadContext('s1');
      expect(messages[0]).toMatchObject({
        role: 'tool',
        content: '{"ok":true}',
        toolCallId: 'call_xyz',
        name: 'searchKnowledgeBase',
      });
    });

    it('uses MAX_CONTEXT_MESSAGES as default limit', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([]);

      await store.loadContext('s1');

      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: MAX_CONTEXT_MESSAGES }),
      );
    });

    it('returns empty array when no messages', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([]);
      const messages = await store.loadContext('s1');
      expect(messages).toEqual([]);
    });
  });
});
