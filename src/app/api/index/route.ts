import { NextResponse } from 'next/server';
import { getConfiguredRepos, indexAllRepositories, indexRepositoriesByConfig } from '@/lib/github';
import { db, getActiveRepos, getRepoByRepoId } from '@/lib/db';
import {
  apiErrorResponse,
  generateRequestId,
  successResponse,
  indexInputSchema,
  NotFoundError,
} from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';

export async function POST(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = indexInputSchema.parse(body);

    let results;

    if (parsed.repoId) {
      const repo = await getRepoByRepoId(db, parsed.repoId);

      if (repo) {
        results = await indexAllRepositories([repo.id]);
      } else {
        const fallbackConfig = getConfiguredRepos().find((config) => {
          const fullName = `${config.owner}/${config.name}`.toLowerCase();
          const displayName = config.displayName.toLowerCase();
          const needle = parsed.repoId!.toLowerCase();
          return (
            fullName === needle ||
            config.name.toLowerCase() === needle ||
            displayName === needle ||
            displayName.includes(needle)
          );
        });

        if (!fallbackConfig) {
          const err = new NotFoundError('Repository', parsed.repoId);
          const { envelope, status } = apiErrorResponse(err, requestId);
          return NextResponse.json(envelope, { status });
        }

        results = await indexRepositoriesByConfig([fallbackConfig]);
      }
    } else {
      const repos = await getActiveRepos(db);
      results = repos.length > 0
        ? await indexAllRepositories(repos.map((repo) => repo.id))
        : await indexRepositoriesByConfig(getConfiguredRepos());
    }

    const failed = results.filter((result) => result.status === 'failed').length;
    const completed = results.length - failed;

    return NextResponse.json(
      successResponse(
        {
          results,
          summary: {
            total: results.length,
            completed,
            failed,
            status:
              failed === 0
                ? 'completed'
                : completed > 0
                  ? 'partial'
                  : 'failed',
          },
        },
        { requestId },
      ),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
