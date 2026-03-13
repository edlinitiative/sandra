import { NextResponse } from 'next/server';
import { getConfiguredRepos } from '@/lib/github';
import { getVectorStore } from '@/lib/knowledge';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const repos = getConfiguredRepos(true);
    const vectorStore = getVectorStore();

    const reposWithStatus = await Promise.all(
      repos.map(async (repo) => {
        const chunkCount = await vectorStore.count(`${repo.owner}/${repo.name}`);
        return {
          name: repo.name,
          displayName: repo.displayName,
          url: repo.url,
          syncStatus: repo.isActive ? (chunkCount > 0 ? 'indexed' : 'not_indexed') : 'not_indexed',
          lastIndexedAt: null,
          documentCount: chunkCount,
        };
      }),
    );

    // Sort alphabetically by name
    reposWithStatus.sort((a, b) => a.name.localeCompare(b.name));

    const totalDocuments = reposWithStatus.reduce((sum, r) => sum + r.documentCount, 0);

    return NextResponse.json(
      successResponse({ repos: reposWithStatus, totalDocuments }, { requestId }),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
