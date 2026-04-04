/**
 * listReminders — list queued reminders for the authenticated user.
 *
 * Required scopes: actions:submit
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';

const inputSchema = z.object({
  status: z
    .enum(['pending', 'executed', 'all'])
    .optional()
    .default('pending')
    .describe("Filter by status: 'pending' (upcoming), 'executed' (delivered), or 'all'"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe('Maximum number of reminders to return'),
});

const listRemindersTool: SandraTool = {
  name: 'listReminders',
  description:
    "List the user's queued reminders. Use when the user asks to see their reminders, what they've scheduled, or what's coming up. Returns reminder messages, delivery times, and channels.",
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'executed', 'all'],
        description: "Filter: 'pending' (upcoming) or 'all'",
        default: 'pending',
      },
      limit: { type: 'number', description: 'Max reminders to return (default 10)', default: 10 },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['actions:submit'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to view your reminders.' };
    }

    try {
      const where: Record<string, unknown> = {
        userId,
        tool: 'queueReminder',
      };
      if (params.status !== 'all') {
        where.status = params.status;
      }

      const actions = await db.actionRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        take: params.limit,
      });

      if (actions.length === 0) {
        return {
          success: true,
          data: {
            message: "You don't have any reminders queued.",
            reminders: [],
          },
        };
      }

      const reminders = actions.map((a) => {
        const actionInput = a.input as Record<string, unknown>;
        return {
          id: a.id,
          message: actionInput.message ?? '(No message)',
          deliverAt: actionInput.deliverAt ?? 'Unknown',
          channel: actionInput.channel ?? a.channel,
          status: a.status,
          queuedAt: a.requestedAt.toISOString(),
        };
      });

      return {
        success: true,
        data: {
          message: `You have ${reminders.length} reminder(s).`,
          reminders,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to list reminders: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(listRemindersTool);
export { listRemindersTool };
