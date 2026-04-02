/**
 * GET /api/actions
 *
 * List action requests (admin only).
 * Supports query parameters: status, tool, userId, limit, offset
 */

import { NextResponse } from 'next/server';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';
import { listActions } from '@/lib/actions/queue';
import type { ActionStatus } from '@/lib/actions/types';

const VALID_STATUSES: ActionStatus[] = ['pending', 'approved', 'rejected', 'executed', 'failed'];

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const url = new URL(request.url);
    const rawStatus  = url.searchParams.get('status');
    const tool       = url.searchParams.get('tool')   ?? undefined;
    const userId     = url.searchParams.get('userId') ?? undefined;
    const limit      = Math.min(parseInt(url.searchParams.get('limit')  ?? '50', 10), 200);
    const offset     = Math.max(parseInt(url.searchParams.get('offset') ?? '0',  10), 0);

    const status =
      rawStatus && VALID_STATUSES.includes(rawStatus as ActionStatus)
        ? (rawStatus as ActionStatus)
        : undefined;

    const { actions, total } = await listActions({ status, tool, userId, limit, offset });

    return NextResponse.json(
      successResponse(
        { actions, total, limit, offset },
        { requestId },
      ),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
