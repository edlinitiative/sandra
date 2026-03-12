import type { PrismaClient, RepoRegistry, SyncStatus } from '@prisma/client';

export async function getActiveRepos(prisma: PrismaClient): Promise<RepoRegistry[]> {
  return prisma.repoRegistry.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getRepoByOwnerAndName(
  prisma: PrismaClient,
  owner: string,
  name: string,
): Promise<RepoRegistry | null> {
  return prisma.repoRegistry.findUnique({
    where: { owner_name: { owner, name } },
  });
}

export async function updateRepoSyncStatus(
  prisma: PrismaClient,
  id: string,
  status: SyncStatus,
): Promise<RepoRegistry> {
  return prisma.repoRegistry.update({
    where: { id },
    data: { syncStatus: status, lastSyncAt: status === 'indexed' ? new Date() : undefined },
  });
}
