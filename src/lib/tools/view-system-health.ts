import { z } from 'zod';
import { toolRegistry } from './registry';
import type { ToolResult, ToolContext } from './types';
import { db } from '@/lib/db';
import { getConnectorRegistry } from '@/lib/connectors';
import { getAllCircuitBreakerStats } from './resilience';
import { createLogger } from '@/lib/utils';

const log = createLogger('tools:system-health');

const inputSchema = z.object({}).strict();

const startTime = Date.now();

async function handler(_input: unknown, context: ToolContext): Promise<ToolResult> {
  log.info('Fetching system health', { sessionId: context.sessionId });

  try {
    // Uptime
    const uptimeMs = Date.now() - startTime;
    const uptimeMinutes = Math.floor(uptimeMs / 60_000);

    // Database health
    let dbLatency: number | null = null;
    let dbStatus: 'ok' | 'error' = 'error';
    try {
      const dbStart = Date.now();
      await db.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
      dbStatus = 'ok';
    } catch {
      // DB unavailable
    }

    // Connector health
    const registry = getConnectorRegistry();
    const connectorHealth = await registry.healthCheckAll();

    // Circuit breaker states
    const circuitBreakers = getAllCircuitBreakerStats();

    // Memory usage
    const mem = process.memoryUsage();
    const memoryMb = {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    };

    // Tool registry stats
    const allTools = toolRegistry.listTools();
    const toolStats = {
      total: allTools.length,
      public: allTools.filter((t) => t.requiredScopes.length === 0 || t.requiredScopes.every((s) => ['knowledge:read', 'repos:read'].includes(s))).length,
      private: allTools.filter((t) => t.requiredScopes.some((s) => s.startsWith('profile:') || s.startsWith('enrollments:') || s.startsWith('certificates:') || s.startsWith('applications:'))).length,
      admin: allTools.filter((t) => t.requiredScopes.includes('admin:tools')).length,
    };

    // DB counts
    let dbCounts: Record<string, number> = {};
    if (dbStatus === 'ok') {
      try {
        const [users, sessions, documents] = await Promise.all([
          db.user.count(),
          db.session.count(),
          db.indexedDocument.count(),
        ]);
        // embedding is an Unsupported("vector(1536)") column — use raw SQL to count vectors
        const vectorResult = await db.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM "IndexedDocument" WHERE embedding IS NOT NULL
        `;
        const vectors = Number(vectorResult[0]?.count ?? 0);
        dbCounts = { users, sessions, documents, vectors };
      } catch {
        // Best effort
      }
    }

    return {
      success: true,
      data: {
        status: dbStatus === 'ok' ? 'healthy' : 'degraded',
        uptimeMinutes,
        database: { status: dbStatus, latencyMs: dbLatency, counts: dbCounts },
        connectors: Object.fromEntries(
          Object.entries(connectorHealth).map(([id, h]) => [
            id,
            { status: h.status, latencyMs: h.latencyMs ?? null },
          ]),
        ),
        circuitBreakers,
        tools: toolStats,
        memory: memoryMb,
        environment: process.env.NODE_ENV ?? 'development',
      },
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch system health',
    };
  }
}

toolRegistry.register({
  name: 'viewSystemHealth',
  description:
    'Get comprehensive system health information including database status, connector health, circuit breaker states, memory usage, and tool registry stats. Requires admin scope.',
  parameters: {
    type: 'object',
    properties: {},
  },
  inputSchema,
  requiredScopes: ['admin:tools'],
  handler,
});
