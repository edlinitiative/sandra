import { describe, it, expect, beforeEach } from 'vitest';
import { mockPrismaClient, resetPrismaMocks } from '@/lib/__tests__/mocks/prisma';
import { createMessage, getMessagesBySessionId } from '../messages';
import type { PrismaClient } from '@prisma/client';

const prisma = mockPrismaClient as unknown as PrismaClient;

describe('message helpers', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  describe('createMessage', () => {
    it('calls prisma.message.create with correct data', async () => {
      const mockMsg = { id: 'msg_1', sessionId: 'sess_1', role: 'user', content: 'Hello' };
      mockPrismaClient.message.create.mockResolvedValue(mockMsg);

      const result = await createMessage(prisma, {
        sessionId: 'sess_1',
        role: 'user',
        content: 'Hello',
      });

      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'sess_1',
          role: 'user',
          content: 'Hello',
          language: undefined,
          toolName: undefined,
          toolCallId: undefined,
          metadata: undefined,
        },
      });
      expect(result).toEqual(mockMsg);
    });

    it('passes tool-related fields when provided', async () => {
      mockPrismaClient.message.create.mockResolvedValue({});

      await createMessage(prisma, {
        sessionId: 'sess_1',
        role: 'tool',
        content: '{"result": "ok"}',
        toolName: 'searchKnowledgeBase',
        toolCallId: 'call_abc',
      });

      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'tool',
          toolName: 'searchKnowledgeBase',
          toolCallId: 'call_abc',
        }),
      });
    });
  });

  describe('getMessagesBySessionId', () => {
    it('queries messages by sessionId', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([]);

      await getMessagesBySessionId(prisma, 'sess_1');

      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'sess_1' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('applies limit when provided', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([]);

      await getMessagesBySessionId(prisma, 'sess_1', { limit: 5 });

      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('returns empty array when session has no messages', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([]);

      const result = await getMessagesBySessionId(prisma, 'empty_sess');
      expect(result).toEqual([]);
    });
  });
});
