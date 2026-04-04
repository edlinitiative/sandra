/**
 * GET /api/learning
 *
 * Returns recent unreviewed learning signals for admin review:
 *   • corrections  — messages where a user corrected a wrong answer
 *   • capabilityGaps — action requests that Sandra couldn't fulfil (no tool ran)
 *
 * Query parameters:
 *   limit  — max items per category (default: 25, max: 100)
 *
 * Auth: admin only (x-admin-key header required).
 */

import { NextResponse } from 'next/server';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';
import { ValidationError } from '@/lib/utils/errors';
import { getLearningSignals } from '@/lib/learning';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    let limit = 25;

    if (limitParam !== null) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError('"limit" must be an integer between 1 and 100');
      }
    }

    const signals = await getLearningSignals(limit);

    return NextResponse.json(
      successResponse(signals, { requestId }),
      { status: 200 },
    );
  } catch (err) {
    const { envelope, status } = apiErrorResponse(err, requestId);
    return NextResponse.json(envelope, { status });
  }
}
