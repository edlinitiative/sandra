import { NextResponse } from 'next/server';
import { indexRepositoriesByConfig, getConfiguredRepos, findRepoConfig, indexAllRepositories } from '@/lib/github';
import { apiErrorResponse, generateRequestId, successResponse, indexInputSchema, ValidationError, NotFoundError } from '@/lib/utils';
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

    const parsed = indexInputSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.flatten();
      const err = new ValidationError('Invalid request', { details });
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    const { repoId } = parsed.data;

    // repoId format: "owner/repo" or just a repo name
    const parts = repoId.split('/');
    let repoConfig = null;

    if (parts.length === 2) {
      const [owner, name] = parts as [string, string];
      repoConfig = findRepoConfig(owner, name);
    } else {
      // Try to find by name only
      const allRepos = getConfiguredRepos(true);
      repoConfig = allRepos.find((r) => r.name === repoId) ?? null;
    }

    if (!repoConfig) {
      const err = new NotFoundError('Repository', repoId);
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    const results = await indexRepositoriesByConfig([repoConfig]);

    return NextResponse.json(successResponse({ results }, { requestId }));
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
