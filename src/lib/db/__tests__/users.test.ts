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

  it('resolves existing user by externalId', async () => {
    const existingUser = { id: 'user_2', externalId: 'web:test' };
    mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
    mockPrismaClient.user.update.mockResolvedValue(existingUser);

    const result = await resolveUserByExternalId(prisma, {
      externalId: 'web:test',
      language: 'fr',
      channel: 'web',
    });

    expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
      where: { externalId: 'web:test' },
    });
    expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
      where: { id: 'user_2' },
      data: { language: 'fr', channel: 'web' },
    });
    expect(result).toEqual(existingUser);
  });

  it('links existing email user when externalId not found', async () => {
    const emailUser = { id: 'user_3', externalId: null, email: 'ted@example.com', role: 'admin' };
    // First findUnique by externalId returns null
    mockPrismaClient.user.findUnique.mockResolvedValue(null);
    // findFirst by email returns the existing user
    mockPrismaClient.user.findFirst.mockResolvedValue(emailUser);
    mockPrismaClient.user.update.mockResolvedValue({ ...emailUser, externalId: 'google:123' });

    const result = await resolveUserByExternalId(prisma, {
      externalId: 'google:123',
      email: 'ted@example.com',
      name: 'Ted',
      channel: 'web',
    });

    expect(mockPrismaClient.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'ted@example.com', externalId: null },
    });
    expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
      where: { id: 'user_3' },
      data: { externalId: 'google:123', name: 'Ted', channel: 'web' },
    });
    expect(result.externalId).toBe('google:123');
  });

  it('creates new user when no match found', async () => {
    const newUser = { id: 'user_4', externalId: 'web:new' };
    mockPrismaClient.user.findUnique.mockResolvedValue(null);
    mockPrismaClient.user.findFirst.mockResolvedValue(null);
    mockPrismaClient.user.create.mockResolvedValue(newUser);

    const result = await resolveUserByExternalId(prisma, {
      externalId: 'web:new',
      language: 'fr',
      channel: 'web',
    });

    expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
      data: {
        externalId: 'web:new',
        name: undefined,
        email: undefined,
        language: 'fr',
        channel: 'web',
        metadata: undefined,
      },
    });
    expect(result).toEqual(newUser);
  });
});
