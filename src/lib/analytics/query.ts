/**
 * Analytics query functions.
 *
 * Aggregate analytics data from the AnalyticsEvent table for reporting.
 */

import { db } from '@/lib/db';
import type { AnalyticsSummary } from './types';

/**
 * Get aggregated analytics summary for a time period.
 * @param fromDate Start of period (default: 24 hours ago)
 * @param toDate   End of period (default: now)
 */
export async function getAnalyticsSummary(
  fromDate?: Date,
  toDate?: Date,
): Promise<AnalyticsSummary> {
  const prisma = db as typeof db & {
    analyticsEvent: {
      count: (args?: {
        where?: Record<string, unknown>;
      }) => Promise<number>;
      groupBy: (args: {
        by: string[];
        where?: Record<string, unknown>;
        _count?: Record<string, boolean>;
        _avg?: Record<string, boolean>;
        orderBy?: Record<string, unknown>;
        take?: number;
      }) => Promise<Array<Record<string, unknown>>>;
      aggregate: (args: {
        where?: Record<string, unknown>;
        _avg?: Record<string, boolean>;
        _count?: Record<string, boolean>;
      }) => Promise<Record<string, unknown>>;
    };
  };

  const to = toDate ?? new Date();
  const from = fromDate ?? new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: from, lte: to } };

  // Total events
  const totalEvents = await prisma.analyticsEvent.count({ where });

  // Group by event type
  const byTypeRaw = await prisma.analyticsEvent.groupBy({
    by: ['eventType'],
    where,
    _count: { id: true },
  });
  const byEventType: Record<string, number> = {};
  for (const row of byTypeRaw) {
    byEventType[row.eventType as string] = ((row._count as Record<string, number>).id) ?? 0;
  }

  // Group by channel
  const byChannelRaw = await prisma.analyticsEvent.groupBy({
    by: ['channel'],
    where: { ...where, channel: { not: null } },
    _count: { id: true },
  });
  const byChannel: Record<string, number> = {};
  for (const row of byChannelRaw) {
    if (row.channel) {
      byChannel[row.channel as string] = ((row._count as Record<string, number>).id) ?? 0;
    }
  }

  // Group by language
  const byLanguageRaw = await prisma.analyticsEvent.groupBy({
    by: ['language'],
    where: { ...where, language: { not: null } },
    _count: { id: true },
  });
  const byLanguage: Record<string, number> = {};
  for (const row of byLanguageRaw) {
    if (row.language) {
      byLanguage[row.language as string] = ((row._count as Record<string, number>).id) ?? 0;
    }
  }

  // Top tools (from tool_executed events)
  const toolStats = await getToolUsageStats(from, to);

  // Average response latency
  const avgResponse = await getAverageResponseLatency(from, to);

  // Cache hit rate
  const cacheHitRate = await getCacheHitRate(from, to);

  return {
    totalEvents,
    byEventType,
    byChannel,
    byLanguage,
    topTools: toolStats.slice(0, 10),
    averageResponseMs: avgResponse,
    cacheHitRate,
    period: { from, to },
  };
}

/**
 * Get tool usage statistics — how many times each tool was called.
 */
export async function getToolUsageStats(
  fromDate?: Date,
  toDate?: Date,
): Promise<Array<{ tool: string; count: number }>> {
  const to = toDate ?? new Date();
  const from = fromDate ?? new Date(to.getTime() - 24 * 60 * 60 * 1000);

  // Raw query to extract tool name from JSON data column
  const rows = await db.$queryRaw<Array<{ tool: string; count: bigint }>>`
    SELECT 
      data->>'toolName' AS tool,
      COUNT(*) AS count
    FROM "AnalyticsEvent"
    WHERE "eventType" = 'tool_executed'
      AND "createdAt" >= ${from}
      AND "createdAt" <= ${to}
      AND data->>'toolName' IS NOT NULL
    GROUP BY data->>'toolName'
    ORDER BY count DESC
    LIMIT 20
  `;

  return rows.map((r: { tool: string; count: bigint }) => ({ tool: r.tool, count: Number(r.count) }));
}

/**
 * Get average response generation latency in milliseconds.
 */
export async function getAverageResponseLatency(
  fromDate?: Date,
  toDate?: Date,
): Promise<number | null> {
  const to = toDate ?? new Date();
  const from = fromDate ?? new Date(to.getTime() - 24 * 60 * 60 * 1000);

  const rows = await db.$queryRaw<Array<{ avg_latency: number | null }>>`
    SELECT AVG((data->>'latencyMs')::numeric) AS avg_latency
    FROM "AnalyticsEvent"
    WHERE "eventType" = 'response_generated'
      AND "createdAt" >= ${from}
      AND "createdAt" <= ${to}
      AND data->>'latencyMs' IS NOT NULL
  `;

  const val = rows[0]?.avg_latency;
  return val != null ? Math.round(Number(val)) : null;
}

/**
 * Get cache hit rate (0–1) over the time period.
 */
export async function getCacheHitRate(
  fromDate?: Date,
  toDate?: Date,
): Promise<number | null> {
  const to = toDate ?? new Date();
  const from = fromDate ?? new Date(to.getTime() - 24 * 60 * 60 * 1000);

  const [responses, cacheHits] = await Promise.all([
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "AnalyticsEvent"
      WHERE "eventType" = 'response_generated'
        AND "createdAt" >= ${from} AND "createdAt" <= ${to}
    `,
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "AnalyticsEvent"
      WHERE "eventType" = 'cache_hit'
        AND "createdAt" >= ${from} AND "createdAt" <= ${to}
    `,
  ]);

  const total = Number(responses[0]?.count ?? 0);
  const hits = Number(cacheHits[0]?.count ?? 0);

  if (total === 0) return null;
  return Math.round((hits / total) * 100) / 100;
}
