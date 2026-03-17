import { NextResponse } from 'next/server';
import { getActiveRepoSummaries, db } from '@/lib/db';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const repos = await getActiveRepoSummaries(db);

    const repoList = repos.map((repo) => ({
      owner: repo.owner,
      name: repo.name,
      displayName: repo.displayName,
      description: repo.description,
      url: repo.url,
      branch: repo.branch,
      docsPath: repo.docsPath,
      isActive: repo.isActive,
      syncStatus: repo.syncStatus,
      lastIndexedAt: repo.lastIndexedAt ? repo.lastIndexedAt.toISOString() : null,
      indexedDocumentCount: repo.indexedDocumentCount,
    }));

    repoList.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(
      successResponse({ repos: repoList }, { requestId }),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
