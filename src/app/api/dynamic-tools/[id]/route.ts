/**
 * PATCH  /api/dynamic-tools/[id]  — update a DynamicTool (toggle enabled, etc.)
 * DELETE /api/dynamic-tools/[id]  — permanently delete a DynamicTool
 */

import { NextResponse } from 'next/server';
import { generateRequestId, successResponse, apiErrorResponse, NotFoundError } from '@/lib/utils';
import { requireAdminAuth } from '@/lib/utils/auth';
import { db } from '@/lib/db';
import { toolRegistry } from '@/lib/tools/registry';
import { logAuditEvent } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;

    const existing = await db.dynamicTool.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Dynamic tool ${id} not found`);

    const updated = await db.dynamicTool.update({
      where: { id },
      data: {
        ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
        ...(typeof body.tested === 'boolean'  ? { tested: body.tested }   : {}),
        ...(typeof body.description === 'string' ? { description: body.description } : {}),
      },
    });

    // If disabling a tool, remove it from the live registry
    if (body.enabled === false && toolRegistry.has(existing.name)) {
      (toolRegistry as unknown as { tools: Map<string, unknown> }).tools.delete(existing.name);
    }

    // If re-enabling a tool, hot-register it again
    if (body.enabled === true && !toolRegistry.has(existing.name)) {
      const { reloadDynamicTool } = await import('@/lib/tools/dynamic-loader');
      await reloadDynamicTool(existing.name);
    }

    await logAuditEvent({
      action: 'admin_action',
      resource: `dynamic-tool:${existing.name}`,
      details: { id, changes: body },
      success: true,
    }).catch(() => {});

    return NextResponse.json(successResponse({ tool: updated }, { requestId }));
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const requestId = generateRequestId();

  try {
    requireAdminAuth(request);

    const { id } = await params;

    const existing = await db.dynamicTool.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Dynamic tool ${id} not found`);

    // Remove from live registry before deleting from DB
    if (toolRegistry.has(existing.name)) {
      (toolRegistry as unknown as { tools: Map<string, unknown> }).tools.delete(existing.name);
    }

    await db.dynamicTool.delete({ where: { id } });

    await logAuditEvent({
      action: 'admin_action',
      resource: `dynamic-tool:${existing.name}`,
      details: { id, deleted: true },
      success: true,
    }).catch(() => {});

    return NextResponse.json(
      successResponse({ deleted: true, name: existing.name }, { requestId }),
    );
  } catch (error) {
    const { envelope, status } = apiErrorResponse(error, requestId);
    return NextResponse.json(envelope, { status });
  }
}
