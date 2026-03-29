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
    // Detect database connectivity errors and return a clear 503 instead of raw Prisma messages
    const msg = error instanceof Error ? error.message : '';
    const isDbUnavailable = /Can't reach database server|Connection refused|ECONNREFUSED/i.test(msg);
    if (isDbUnavailable) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is currently unavailable. Repository data requires a running database.' },
          meta: { requestId },
        },
        { status: 503 },
      );
    }
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
