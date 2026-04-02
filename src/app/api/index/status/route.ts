import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getVectorStore } from '@/lib/knowledge';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const repos = await db.repoRegistry.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        owner: true,
        name: true,
        displayName: true,
        syncStatus: true,
        lastSyncAt: true,
        isActive: true,
      },
    });

    // Get document counts per source
    const sources = await db.indexedSource.findMany({
      select: {
        id: true,
        owner: true,
        repo: true,
        documentCount: true,
        lastIndexedAt: true,
      },
    });

    const sourceByRepoKey = new Map(
      sources.map((s) => [`${s.owner}/${s.repo}`, s]),
    );

    // Get vector store count
    let vectorStoreChunks: number | null = null;
    try {
      const vectorStore = getVectorStore();
      vectorStoreChunks = await vectorStore.count();
    } catch {
      // Best effort
    }

    const repoStatuses = repos.map((repo) => {
      const repoKey = `${repo.owner}/${repo.name}`;
      const source = sourceByRepoKey.get(repoKey);
      return {
        id: repo.id,
        repoFullName: repoKey,
        displayName: repo.displayName,
        syncStatus: repo.syncStatus,
        lastIndexedAt: repo.lastSyncAt?.toISOString() ?? null,
        documentCount: source?.documentCount ?? 0,
      };
    });

    const summary = {
      total: repos.length,
      indexed: repos.filter((r) => r.syncStatus === 'indexed').length,
      indexing: repos.filter((r) => r.syncStatus === 'indexing').length,
      error: repos.filter((r) => r.syncStatus === 'error').length,
      notIndexed: repos.filter((r) => r.syncStatus === 'not_indexed').length,
      vectorStoreChunks,
    };

    return NextResponse.json(
      successResponse({ repos: repoStatuses, summary }, { requestId }),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
