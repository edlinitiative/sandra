/**
 * POST /api/actions/[id]/reject
 *
 * Reject a pending action request (admin only).
 * Body: { reviewedBy: string, reason?: string }
 */

import { NextResponse } from 'next/server';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';
import { rejectAction } from '@/lib/actions/queue';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const { id } = await params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const reviewedBy = typeof body.reviewedBy === 'string' && body.reviewedBy.trim()
      ? body.reviewedBy.trim()
      : 'admin';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : undefined;

    const action = await rejectAction(id, reviewedBy, reason);

    return NextResponse.json(successResponse({ action }, { requestId }));
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
