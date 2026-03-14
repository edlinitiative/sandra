import { NextResponse } from 'next/server';
import { getActiveRepos, db } from '@/lib/db';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const repos = await getActiveRepos(db);

    const repoList = repos.map((repo) => ({
      name: repo.name,
      displayName: repo.displayName,
      url: repo.url,
      syncStatus: repo.syncStatus,
      lastIndexedAt: repo.lastSyncAt ? repo.lastSyncAt.toISOString() : null,
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
