import { NextResponse } from 'next/server';
import { db, getActiveRepos } from '@/lib/db';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const repos = await getActiveRepos(db);

    const reposWithStatus = repos.map((repo) => ({
      name: repo.name,
      displayName: repo.displayName,
      url: repo.url,
      syncStatus: repo.syncStatus,
      lastIndexedAt: repo.lastSyncAt?.toISOString() ?? null,
      documentCount: 0,
    }));

    // Sort alphabetically by name
    reposWithStatus.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(
      successResponse({ repos: reposWithStatus, totalDocuments: 0 }, { requestId }),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
