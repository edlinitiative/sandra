import { NextResponse } from 'next/server';
import { db, getActiveRepos } from '@/lib/db';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const repos = await getActiveRepos(db);

    const reposWithStatus = await Promise.all(
      repos.map(async (repo) => {
        const source = await db.indexedSource.findFirst({
          where: {
            owner: repo.owner,
            repo: repo.name,
          },
          select: { id: true },
        });

        const documentCount = source
          ? await db.indexedDocument.count({
              where: { sourceId: source.id },
            })
          : 0;

        return {
          name: repo.name,
          displayName: repo.displayName,
          url: repo.url,
          syncStatus: repo.syncStatus,
          lastIndexedAt: repo.lastSyncAt,
          documentCount,
        };
      }),
    );

    reposWithStatus.sort((a, b) => a.name.localeCompare(b.name));

    const totalDocuments = reposWithStatus.reduce(
      (sum, repo) => sum + repo.documentCount,
      0,
    );

    return NextResponse.json(
      successResponse({ repos: reposWithStatus, totalDocuments }, { requestId }),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
