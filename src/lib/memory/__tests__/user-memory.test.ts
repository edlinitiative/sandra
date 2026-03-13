import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { mockPrismaClient, resetPrismaMocks } from '@/lib/__tests__/mocks/prisma';

vi.mock('@/lib/db', () => ({
  db: mockPrismaClient as unknown as PrismaClient,
}));

import { InMemoryUserMemoryStore } from '../user-memory';
import { setSessionMemory, getSessionMemory } from '../user-memory';

describe('InMemoryUserMemoryStore', () => {
  let store: InMemoryUserMemoryStore;

  beforeEach(() => {
    store = new InMemoryUserMemoryStore();
  });

  it('saves and retrieves a memory entry', async () => {
    const entry = { key: 'name', value: 'Alice', source: 'conversation', confidence: 1.0, updatedAt: new Date() };
    await store.saveMemory('user1', entry);

    const result = await store.getMemory('user1', 'name');
    expect(result).toEqual(entry);
  });

  it('returns null for missing key', async () => {
    const result = await store.getMemory('user1', 'missing');
    expect(result).toBeNull();
  });

  it('getMemories returns all entries for a user', async () => {
    await store.saveMemory('user1', { key: 'a', value: '1', source: 'conversation', confidence: 1.0, updatedAt: new Date() });
    await store.saveMemory('user1', { key: 'b', value: '2', source: 'conversation', confidence: 1.0, updatedAt: new Date() });

    const all = await store.getMemories('user1');
    expect(all).toHaveLength(2);
  });

  it('upserts on saveMemory (same key overwrites)', async () => {
    const e1 = { key: 'name', value: 'Alice', source: 'conversation', confidence: 1.0, updatedAt: new Date() };
    const e2 = { key: 'name', value: 'Bob', source: 'conversation', confidence: 1.0, updatedAt: new Date() };
    await store.saveMemory('user1', e1);
    await store.saveMemory('user1', e2);

    const result = await store.getMemory('user1', 'name');
    expect(result?.value).toBe('Bob');
    const all = await store.getMemories('user1');
    expect(all).toHaveLength(1);
  });

  it('deleteMemory removes a specific key', async () => {
    await store.saveMemory('user1', { key: 'name', value: 'Alice', source: 'conversation', confidence: 1.0, updatedAt: new Date() });
    await store.deleteMemory('user1', 'name');

    const result = await store.getMemory('user1', 'name');
    expect(result).toBeNull();
  });

  it('getMemorySummary returns empty string when no memories', async () => {
    const summary = await store.getMemorySummary('user1');
    expect(summary).toBe('');
  });

  it('getMemorySummary formats memories as a list', async () => {
    await store.saveMemory('user1', { key: 'name', value: 'Alice', source: 'conversation', confidence: 1.0, updatedAt: new Date() });
    const summary = await store.getMemorySummary('user1');
    expect(summary).toContain('name: Alice');
  });
});

describe('setSessionMemory / getSessionMemory', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('upserts memory in Prisma when called', async () => {
    mockPrismaClient.memory.upsert.mockResolvedValue({ id: 'm1', key: 'topic', value: 'coding' });

    await setSessionMemory('sess_1', 'topic', 'coding');

    expect(mockPrismaClient.memory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_key: { userId: 'session:sess_1', key: 'topic' } },
        create: expect.objectContaining({ key: 'topic', value: 'coding', source: 'conversation' }),
      }),
    );
  });

  it('uses real userId when provided', async () => {
    mockPrismaClient.memory.upsert.mockResolvedValue({ id: 'm2', key: 'lang', value: 'fr' });

    await setSessionMemory('sess_1', 'lang', 'fr', 'user_abc');

    expect(mockPrismaClient.memory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_key: { userId: 'user_abc', key: 'lang' } },
      }),
    );
  });

  it('getSessionMemory returns a key-value map', async () => {
    mockPrismaClient.memory.findMany.mockResolvedValue([
      { key: 'topic', value: 'coding' },
      { key: 'name', value: 'Alice' },
    ]);

    const result = await getSessionMemory('sess_1');

    expect(result).toEqual({ topic: 'coding', name: 'Alice' });
  });

  it('getSessionMemory returns empty object when no memories', async () => {
    mockPrismaClient.memory.findMany.mockResolvedValue([]);
    const result = await getSessionMemory('sess_1');
    expect(result).toEqual({});
  });
});
