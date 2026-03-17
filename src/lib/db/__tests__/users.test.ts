import { describe, it, expect, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { mockPrismaClient, resetPrismaMocks } from '@/lib/__tests__/mocks/prisma';
import { getUserById, getUserByExternalId, resolveUserByExternalId } from '../users';

const prisma = mockPrismaClient as unknown as PrismaClient;

describe('user helpers', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('looks up a user by id', async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'user_1' });

    const result = await getUserById(prisma, 'user_1');

    expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user_1' },
    });
    expect(result).toEqual({ id: 'user_1' });
  });

  it('looks up a user by external id', async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'user_1', externalId: 'web:test' });

    const result = await getUserByExternalId(prisma, 'web:test');

    expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
      where: { externalId: 'web:test' },
    });
    expect(result).toEqual({ id: 'user_1', externalId: 'web:test' });
  });

  it('upserts a user from an external id', async () => {
    mockPrismaClient.user.upsert.mockResolvedValue({ id: 'user_2', externalId: 'web:test' });

    const result = await resolveUserByExternalId(prisma, {
      externalId: 'web:test',
      language: 'fr',
      channel: 'web',
    });

    expect(mockPrismaClient.user.upsert).toHaveBeenCalledWith({
      where: { externalId: 'web:test' },
      create: {
        externalId: 'web:test',
        name: undefined,
        email: undefined,
        language: 'fr',
        channel: 'web',
        metadata: undefined,
      },
      update: {
        language: 'fr',
        channel: 'web',
      },
    });
    expect(result).toEqual({ id: 'user_2', externalId: 'web:test' });
  });
});
