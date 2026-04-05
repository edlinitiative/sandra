/**
 * GET  /api/tools/connections/[connectionId] — Get connection details + its tools
 * PATCH /api/tools/connections/[connectionId] — Update connection (toggle active, update creds)
 * DELETE /api/tools/connections/[connectionId] — Remove connection and all its tools
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { removeApiConnection } from '@/lib/tools/tenant-tool-loader';
import { createLogger } from '@/lib/utils';

const log = createLogger('api:tools:connections');

interface RouteContext {
  params: Promise<{ connectionId: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { connectionId } = await context.params;
    const connection = await db.externalApiConnection.findUnique({
      where: { id: connectionId },
      include: {
        tools: {
          select: { id: true, name: true, description: true, enabled: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: connection.id,
      tenantId: connection.tenantId,
      name: connection.name,
      baseUrl: connection.baseUrl,
      authType: connection.authType,
      rateLimitRpm: connection.rateLimitRpm,
      isActive: connection.isActive,
      lastHealthCheck: connection.lastHealthCheck,
      lastHealthStatus: connection.lastHealthStatus,
      createdAt: connection.createdAt,
      tools: connection.tools,
      toolCount: connection.tools.length,
    });
  } catch (error) {
    log.error('Failed to get connection', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { connectionId } = await context.params;
    const body = await request.json();
    const { isActive, credentials, authConfig, defaultHeaders, rateLimitRpm } = body as Record<string, unknown>;

    const existing = await db.externalApiConnection.findUnique({ where: { id: connectionId } });
    if (!existing) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    if (credentials && typeof credentials === 'object') updates.credentials = credentials;
    if (authConfig && typeof authConfig === 'object') updates.authConfig = authConfig;
    if (defaultHeaders && typeof defaultHeaders === 'object') updates.defaultHeaders = defaultHeaders;
    if (typeof rateLimitRpm === 'number') updates.rateLimitRpm = rateLimitRpm;

    const updated = await db.externalApiConnection.update({
      where: { id: connectionId },
      data: updates,
    });

    // If connection was deactivated, disable all its tools
    if (isActive === false) {
      await db.dynamicTool.updateMany({
        where: { apiConnectionId: connectionId },
        data: { enabled: false },
      });
    }

    // If connection was reactivated, re-enable all its tools
    if (isActive === true) {
      await db.dynamicTool.updateMany({
        where: { apiConnectionId: connectionId },
        data: { enabled: true },
      });
    }

    log.info(`Updated connection ${connectionId}`, { updates: Object.keys(updates) });

    return NextResponse.json({
      id: updated.id,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    log.error('Failed to update connection', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { connectionId } = await context.params;

    const existing = await db.externalApiConnection.findUnique({ where: { id: connectionId } });
    if (!existing) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    await removeApiConnection(connectionId);

    log.info(`Deleted connection ${connectionId}`);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    log.error('Failed to delete connection', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
