/**
 * GET /api/analytics
 *
 * Returns aggregated analytics summary (admin only).
 *
 * Query parameters:
 *   from  — ISO date string, start of window (optional, defaults to 7 days ago)
 *   to    — ISO date string, end of window   (optional, defaults to now)
 */

import { NextResponse } from 'next/server';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';
import { ValidationError } from '@/lib/utils/errors';
import { getAnalyticsSummary } from '@/lib/analytics';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const url = new URL(request.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = toParam ? new Date(toParam) : new Date();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new ValidationError('Invalid date parameters: "from" and "to" must be valid ISO date strings');
    }

    if (from > to) {
      throw new ValidationError('"from" must be before "to"');
    }

    const summary = await getAnalyticsSummary(from, to);

    return NextResponse.json(
      successResponse(summary, { requestId }),
      { status: 200 },
    );
  } catch (err) {
    const { envelope, status } = apiErrorResponse(err, requestId);
    return NextResponse.json(envelope, { status });
  }
}
