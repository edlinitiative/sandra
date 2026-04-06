/**
 * POST /api/capability-gaps/[id]/generate
 *
 * Triggers scaffoldTool from an existing CapabilityGap record, then marks
 * the gap as reviewed. Admin only.
 *
 * Body (optional):
 *   { "dryRun": boolean }  — pass dryRun:true to preview without saving
 */

import { NextResponse } from 'next/server';
import {
  generateRequestId,
  successResponse,
  apiErrorResponse,
  NotFoundError,
} from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';
import { authenticateRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import type { ToolContext } from '@/lib/tools/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const requestId = generateRequestId();

  try {
    // Require authentication
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    requireAdminAuth(request);

    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { dryRun?: boolean };

    const gap = await db.capabilityGap.findUnique({ where: { id } });
    if (!gap) throw new NotFoundError(`Capability gap ${id} not found`);

    // Import and invoke the scaffoldTool handler directly
    const { scaffoldToolDef } = await import('@/lib/tools/scaffold-tool');

    const context: ToolContext = {
      sessionId: gap.sessionId,
      userId:    gap.userId ?? 'admin_dashboard',
      scopes:    ['admin:tools'],
    };

    const result = await scaffoldToolDef.handler(
      {
        intent:       gap.userMessage,
        sourceGapIds: [id],
        dryRun:       body.dryRun ?? false,
      },
      context,
    );

    // Mark gap as reviewed (even if generation failed — admin has seen it)
    if (!body.dryRun) {
      await db.capabilityGap.update({
        where: { id },
        data: { reviewed: true },
      }).catch(() => {});
    }

    return NextResponse.json(successResponse({ result, gapId: id }, { requestId }));
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
