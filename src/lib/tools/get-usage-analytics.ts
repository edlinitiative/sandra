/**
 * getUsageAnalytics — pull Sandra platform usage statistics.
 *
 * Returns event counts, channel breakdown, top tools, response latency,
 * and cache hit rate for a configurable time window.
 *
 * Required scopes: admin:tools
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { getAnalyticsSummary, getToolUsageStats } from '@/lib/analytics';
import { logAuditEvent } from '@/lib/audit';

const inputSchema = z.object({
  fromDate: z
    .string()
    .optional()
    .describe("Start date (ISO 8601, e.g. '2025-01-01'). Defaults to 24 hours ago."),
  toDate: z
    .string()
    .optional()
    .describe("End date (ISO 8601, e.g. '2025-01-31'). Defaults to now."),
  breakdown: z
    .enum(['summary', 'tools', 'full'])
    .optional()
    .default('summary')
    .describe("'summary' for totals, 'tools' for per-tool stats, 'full' for everything"),
});

const getUsageAnalyticsTool: SandraTool = {
  name: 'getUsageAnalytics',
  description:
    "Get Sandra platform usage analytics: message counts, active channels, top tools used, response latency, and cache rates. Supports custom date ranges. ADMIN ONLY.",
  parameters: {
    type: 'object',
    properties: {
      fromDate: {
        type: 'string',
        description: "Start date ISO 8601 (e.g. '2025-01-01'). Defaults to last 24 hours.",
      },
      toDate: {
        type: 'string',
        description: "End date ISO 8601. Defaults to now.",
      },
      breakdown: {
        type: 'string',
        enum: ['summary', 'tools', 'full'],
        description: "Level of detail: 'summary', 'tools', or 'full'",
      },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['admin:tools'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required.' };
    }

    const from = params.fromDate ? new Date(params.fromDate) : undefined;
    const to = params.toDate ? new Date(params.toDate) : undefined;

    if (from && isNaN(from.getTime())) {
      return { success: false, data: null, error: `Invalid fromDate: ${params.fromDate}` };
    }
    if (to && isNaN(to.getTime())) {
      return { success: false, data: null, error: `Invalid toDate: ${params.toDate}` };
    }

    try {
      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'admin_action',
        resource: 'getUsageAnalytics',
        details: { fromDate: params.fromDate, toDate: params.toDate, breakdown: params.breakdown },
        success: true,
      }).catch(() => {});

      if (params.breakdown === 'tools') {
        const toolStats = await getToolUsageStats(from, to);
        return {
          success: true,
          data: {
            period: {
              from: (from ?? new Date(Date.now() - 86400000)).toISOString(),
              to: (to ?? new Date()).toISOString(),
            },
            toolUsage: toolStats,
          },
        };
      }

      const summary = await getAnalyticsSummary(from, to);

      if (params.breakdown === 'summary') {
        return {
          success: true,
          data: {
            period: {
              from: summary.period.from.toISOString(),
              to: summary.period.to.toISOString(),
            },
            totalEvents: summary.totalEvents,
            byChannel: summary.byChannel,
            byEventType: summary.byEventType,
            averageResponseMs: summary.averageResponseMs,
            cacheHitRate: summary.cacheHitRate,
          },
        };
      }

      // full
      return {
        success: true,
        data: {
          period: {
            from: summary.period.from.toISOString(),
            to: summary.period.to.toISOString(),
          },
          totalEvents: summary.totalEvents,
          byEventType: summary.byEventType,
          byChannel: summary.byChannel,
          byLanguage: summary.byLanguage,
          topTools: summary.topTools,
          averageResponseMs: summary.averageResponseMs,
          cacheHitRate: summary.cacheHitRate,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve analytics: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(getUsageAnalyticsTool);
export { getUsageAnalyticsTool };
