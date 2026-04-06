/**
 * GET  /api/tools/tenant/[tenantId] — List all tools for a tenant
 * PATCH /api/tools/tenant/[tenantId] — Enable/disable a specific tool
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth/middleware';
import { createLogger } from '@/lib/utils';

const log = createLogger('api:tools:tenant');

interface RouteContext {
  params: Promise<{ tenantId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { tenantId } = await context.params;

    // Verify the caller has access to this tenant
    if (auth.user.tenantId && auth.user.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tools = await db.dynamicTool.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        enabled: true,
        tested: true,
        apiConnectionId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ tenantId, tools, count: tools.length });
  } catch (error) {
    log.error('Failed to list tenant tools', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { tenantId } = await context.params;

    // Verify the caller has access to this tenant
    if (auth.user.tenantId && auth.user.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { toolId, enabled } = body as { toolId?: string; enabled?: boolean };

    if (!toolId || typeof toolId !== 'string') {
      return NextResponse.json({ error: 'toolId is required' }, { status: 400 });
    }
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 });
    }

    // Verify the tool belongs to this tenant
    const tool = await db.dynamicTool.findFirst({
      where: { id: toolId, tenantId },
    });

    if (!tool) {
      return NextResponse.json({ error: 'Tool not found for this tenant' }, { status: 404 });
    }

    const updated = await db.dynamicTool.update({
      where: { id: toolId },
      data: { enabled },
    });

    log.info(`Tool ${toolId} ${enabled ? 'enabled' : 'disabled'} for tenant ${tenantId}`);

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      enabled: updated.enabled,
    });
  } catch (error) {
    log.error('Failed to update tenant tool', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
