/**
 * GET /api/tools/connections — List all API connections for a tenant
 *
 * Query params:
 *   tenantId: string (required) — Filter by tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';

const log = createLogger('api:tools:connections:list');

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId query parameter is required' }, { status: 400 });
    }

    const connections = await db.externalApiConnection.findMany({
      where: { tenantId },
      include: {
        _count: { select: { tools: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      connections: connections.map((c) => ({
        id: c.id,
        name: c.name,
        baseUrl: c.baseUrl,
        authType: c.authType,
        isActive: c.isActive,
        toolCount: c._count.tools,
        lastHealthCheck: c.lastHealthCheck,
        lastHealthStatus: c.lastHealthStatus,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    log.error('Failed to list connections', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
