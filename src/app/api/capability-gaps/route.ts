/**
 * GET /api/capability-gaps
 *
 * List CapabilityGap records (admin only).
 *
 * Query params:
 *   reviewed=false  — only unreviewed gaps (default)
 *   reviewed=true   — only reviewed gaps
 *   reviewed=all    — all gaps
 *   limit           — max results (default 50, max 200)
 *   offset          — pagination offset
 */

import { NextResponse } from 'next/server';
import { generateRequestId, successResponse, apiErrorResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';
import { authenticateRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    // Require authentication
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    requireAdminAuth(request);

    const url = new URL(request.url);
    const reviewedParam = url.searchParams.get('reviewed') ?? 'false';
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  ?? '50',  10), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0',   10), 0);

    const reviewedFilter =
      reviewedParam === 'all'  ? undefined :
      reviewedParam === 'true' ? true       :
      false; // default: unreviewed only

    const where = reviewedFilter === undefined ? {} : { reviewed: reviewedFilter };

    const [gaps, total] = await Promise.all([
      db.capabilityGap.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.capabilityGap.count({ where }),
    ]);

    return NextResponse.json(
      successResponse({ gaps, total, limit, offset }, { requestId }),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
