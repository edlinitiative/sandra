import { NextResponse } from 'next/server';
import { db, getActiveRepos } from '@/lib/db';
import { indexRepository } from '@/lib/github';
import {
  apiErrorResponse,
  generateRequestId,
  successResponse,
  indexInputSchema,
  ValidationError,
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

    const parsed = indexInputSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.flatten();
      const err = new ValidationError('Invalid request', { details });
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    const { repoId } = parsed.data;

    const repos = await getActiveRepos(db);

    let repo = repos.find((r) => r.id === repoId) ?? null;

    if (!repo) {
      const parts = repoId.split('/');
      if (parts.length === 2) {
        const [owner, name] = parts;
        repo = repos.find((r) => r.owner === owner && r.name === name) ?? null;
      } else {
        repo = repos.find((r) => r.name === repoId) ?? null;
      }
    }

    if (!repo) {
      const err = new NotFoundError('Repository', repoId);
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    const result = await indexRepository(repo.id);

    return NextResponse.json(
      successResponse({ results: [result] }, { requestId }),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
