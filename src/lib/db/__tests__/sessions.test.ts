import { describe, it, expect, beforeEach } from 'vitest';
import { mockPrismaClient, resetPrismaMocks } from '@/lib/__tests__/mocks/prisma';
import { createSession, getSessionById, getSessionMessages, updateSession } from '../sessions';
import type { PrismaClient } from '@prisma/client';

const prisma = mockPrismaClient as unknown as PrismaClient;

describe('session helpers', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  describe('createSession', () => {
    it('calls prisma.session.create with correct data', async () => {
      const mockSession = { id: 'sess_1', channel: 'web', language: 'en', isActive: true };
      mockPrismaClient.session.create.mockResolvedValue(mockSession);

      const result = await createSession(prisma, { channel: 'web', language: 'en' });

      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          channel: 'web',
          language: 'en',
          title: undefined,
          metadata: undefined,
        },
      });
      expect(result).toEqual(mockSession);
    });

    it('uses defaults when optional fields are omitted', async () => {
      const mockSession = { id: 'sess_2', channel: 'web', language: 'en' };
      mockPrismaClient.session.create.mockResolvedValue(mockSession);

      await createSession(prisma, {});

      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ channel: 'web', language: 'en' }),
      });
    });
  });

  describe('getSessionById', () => {
    it('returns session when found', async () => {
      const mockSession = { id: 'sess_1', isActive: true };
      mockPrismaClient.session.findUnique.mockResolvedValue(mockSession);

      const result = await getSessionById(prisma, 'sess_1');

      expect(mockPrismaClient.session.findUnique).toHaveBeenCalledWith({ where: { id: 'sess_1' } });
      expect(result).toEqual(mockSession);
    });

    it('returns null when not found', async () => {
      mockPrismaClient.session.findUnique.mockResolvedValue(null);

      const result = await getSessionById(prisma, 'missing');
      expect(result).toBeNull();
    });
  });

  describe('getSessionMessages', () => {
    it('queries messages by sessionId in asc order', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([]);

      await getSessionMessages(prisma, 'sess_1');

      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'sess_1' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('applies limit when provided', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([]);

      await getSessionMessages(prisma, 'sess_1', { limit: 10 });

      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('returns empty array when no messages', async () => {
      mockPrismaClient.message.findMany.mockResolvedValue([]);

      const result = await getSessionMessages(prisma, 'sess_1');
      expect(result).toEqual([]);
    });
  });

  describe('updateSession', () => {
    it('calls prisma.session.update with provided fields', async () => {
      const updated = { id: 'sess_1', title: 'New Title', isActive: true };
      mockPrismaClient.session.update.mockResolvedValue(updated);

      const result = await updateSession(prisma, 'sess_1', { title: 'New Title' });

      expect(mockPrismaClient.session.update).toHaveBeenCalledWith({
        where: { id: 'sess_1' },
        data: { title: 'New Title' },
      });
      expect(result).toEqual(updated);
    });

    it('only includes provided fields in update data', async () => {
      mockPrismaClient.session.update.mockResolvedValue({});

      await updateSession(prisma, 'sess_1', { isActive: false });

      expect(mockPrismaClient.session.update).toHaveBeenCalledWith({
        where: { id: 'sess_1' },
        data: { isActive: false },
      });
    });

    it('supports linking a session to a user', async () => {
      mockPrismaClient.session.update.mockResolvedValue({});

      await updateSession(prisma, 'sess_1', { userId: 'user_123' });

      expect(mockPrismaClient.session.update).toHaveBeenCalledWith({
        where: { id: 'sess_1' },
        data: { userId: 'user_123' },
      });
    });
  });
});
