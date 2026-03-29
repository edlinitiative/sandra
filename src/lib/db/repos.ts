import type { PrismaClient, RepoRegistry, SyncStatus } from '@prisma/client';

export interface RepoSummary {
  id: string;
  owner: string;
  name: string;
  displayName: string;
  description: string | null;
  url: string;
  branch: string;
  docsPath: string | null;
  isActive: boolean;
  syncStatus: SyncStatus;
  lastIndexedAt: Date | null;
  indexedDocumentCount: number;
}

export async function getActiveRepos(prisma: PrismaClient): Promise<RepoRegistry[]> {
  return prisma.repoRegistry.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getActiveRepoSummaries(prisma: PrismaClient): Promise<RepoSummary[]> {
  const repos = await getActiveRepos(prisma);

  if (repos.length === 0) {
    return [];
  }

  const sources = await prisma.indexedSource.findMany({
    where: {
      OR: repos.map((repo) => ({
        owner: repo.owner,
        repo: repo.name,
      })),
    },
    select: {
      id: true,
      owner: true,
      repo: true,
      documentCount: true,
    },
  });

  const sourceIds = sources.map((source) => source.id);
  const groupedDocumentCounts = sourceIds.length > 0
    ? await prisma.indexedDocument.groupBy({
        by: ['sourceId'],
        where: { sourceId: { in: sourceIds } },
        _count: { _all: true },
      })
    : [];

  const documentCountsBySourceId = new Map(
    groupedDocumentCounts.map((entry) => [entry.sourceId, entry._count._all]),
  );

  const sourceByRepoKey = new Map(
    sources.map((source) => [`${source.owner}/${source.repo}`, source]),
  );

  return repos.map((repo) => {
    const repoKey = `${repo.owner}/${repo.name}`;
    const source = sourceByRepoKey.get(repoKey);
    const indexedDocumentCount = source
      ? (documentCountsBySourceId.get(source.id) ?? source.documentCount)
      : 0;

    return {
      id: repo.id,
      owner: repo.owner,
      name: repo.name,
      displayName: repo.displayName,
      description: repo.description,
      url: repo.url,
      branch: repo.branch,
      docsPath: repo.docsPath,
      isActive: repo.isActive,
      syncStatus: repo.syncStatus,
      lastIndexedAt: repo.lastSyncAt,
      indexedDocumentCount,
    };
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

export async function getRepoById(
  prisma: PrismaClient,
  id: string,
): Promise<RepoRegistry | null> {
  return prisma.repoRegistry.findUnique({ where: { id } });
}

export async function getRepoByRepoId(
  prisma: PrismaClient,
  repoId: string,
): Promise<RepoRegistry | null> {
  const normalized = repoId.trim().toLowerCase();
  const repos = await getActiveRepos(prisma);

  return (
    repos.find((repo) => `${repo.owner}/${repo.name}`.toLowerCase() === normalized) ??
    repos.find((repo) => repo.name.toLowerCase() === normalized) ??
    repos.find((repo) => repo.displayName.toLowerCase() === normalized) ??
    repos.find((repo) => repo.displayName.toLowerCase().includes(normalized)) ??
    null
  );
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
