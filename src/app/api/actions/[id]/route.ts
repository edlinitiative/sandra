/**
 * GET /api/actions/[id]
 *
 * Fetch a single action request by ID (admin only).
 */

import { NextResponse } from 'next/server';
import { apiErrorResponse, generateRequestId, successResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';
import { authenticateRequest } from '@/lib/auth/middleware';
import { getActionById } from '@/lib/actions/queue';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();

  try {
    // Require authentication
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    requireAdminAuth(request);

    const { id } = await params;
    const action = await getActionById(id);

    if (!action) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Action ${id} not found` }, meta: { requestId } },
        { status: 404 },
      );
    }

    return NextResponse.json(successResponse({ action }, { requestId }));
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
