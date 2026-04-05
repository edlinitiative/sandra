/**
 * GET  /api/dynamic-tools  — list all DynamicTool records (admin only)
 * POST /api/dynamic-tools  — (reserved for future direct creation)
 */

import { NextResponse } from 'next/server';
import { generateRequestId, successResponse, apiErrorResponse } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const url = new URL(request.url);
    const enabledOnly = url.searchParams.get('enabled') === 'true';

    const tools = await db.dynamicTool.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      successResponse({ tools, total: tools.length }, { requestId }),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
