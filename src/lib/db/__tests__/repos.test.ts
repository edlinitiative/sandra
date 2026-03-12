import { describe, it, expect, beforeEach } from 'vitest';
import { mockPrismaClient, resetPrismaMocks } from '@/lib/__tests__/mocks/prisma';
import { getActiveRepos, getRepoByOwnerAndName, updateRepoSyncStatus } from '../repos';
import type { PrismaClient } from '@prisma/client';

const prisma = mockPrismaClient as unknown as PrismaClient;

describe('repo helpers', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  describe('getActiveRepos', () => {
    it('queries repos where isActive is true', async () => {
      const repos = [{ id: 'repo_1', name: 'code', isActive: true }];
      mockPrismaClient.repoRegistry.findMany.mockResolvedValue(repos);

      const result = await getActiveRepos(prisma);

      expect(mockPrismaClient.repoRegistry.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(repos);
    });

    it('returns empty array when no active repos', async () => {
      mockPrismaClient.repoRegistry.findMany.mockResolvedValue([]);

      const result = await getActiveRepos(prisma);
      expect(result).toEqual([]);
    });
  });

  describe('getRepoByOwnerAndName', () => {
    it('queries by compound owner_name key', async () => {
      const repo = { id: 'repo_1', owner: 'edlinitiative', name: 'code' };
      mockPrismaClient.repoRegistry.findUnique.mockResolvedValue(repo);

      const result = await getRepoByOwnerAndName(prisma, 'edlinitiative', 'code');

      expect(mockPrismaClient.repoRegistry.findUnique).toHaveBeenCalledWith({
        where: { owner_name: { owner: 'edlinitiative', name: 'code' } },
      });
      expect(result).toEqual(repo);
    });

    it('returns null when repo not found', async () => {
      mockPrismaClient.repoRegistry.findUnique.mockResolvedValue(null);

      const result = await getRepoByOwnerAndName(prisma, 'unknown', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('updateRepoSyncStatus', () => {
    it('updates syncStatus to the given value', async () => {
      const updated = { id: 'repo_1', syncStatus: 'indexing' };
      mockPrismaClient.repoRegistry.update.mockResolvedValue(updated);

      await updateRepoSyncStatus(prisma, 'repo_1', 'indexing');

      expect(mockPrismaClient.repoRegistry.update).toHaveBeenCalledWith({
        where: { id: 'repo_1' },
        data: expect.objectContaining({ syncStatus: 'indexing' }),
      });
    });

    it('sets lastSyncAt when status is indexed', async () => {
      mockPrismaClient.repoRegistry.update.mockResolvedValue({});

      await updateRepoSyncStatus(prisma, 'repo_1', 'indexed');

      const call = mockPrismaClient.repoRegistry.update.mock.calls[0]![0]!
      expect(call.data.lastSyncAt).toBeInstanceOf(Date);
    });

    it('does not set lastSyncAt for non-indexed statuses', async () => {
      mockPrismaClient.repoRegistry.update.mockResolvedValue({});

      await updateRepoSyncStatus(prisma, 'repo_1', 'error');

      const call = mockPrismaClient.repoRegistry.update.mock.calls[0]![0]!
      expect(call.data.lastSyncAt).toBeUndefined();
    });
  });
});
