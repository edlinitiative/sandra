import { NextResponse } from 'next/server';
import { indexRepositoriesByConfig, findRepoConfig } from '@/lib/github';
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

    const repoConfig = findRepoConfig(repoId);

    if (!repoConfig) {
      const err = new NotFoundError('Repository', repoId);
      const { envelope, status } = apiErrorResponse(err, requestId);
      return NextResponse.json(envelope, { status });
    }

    const results = await indexRepositoriesByConfig([repoConfig]);

    return NextResponse.json(
      successResponse({ results }, { requestId }),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
