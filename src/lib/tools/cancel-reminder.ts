/**
 * cancelReminder — cancel a queued reminder by ID.
 *
 * Required scopes: actions:submit
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';

const inputSchema = z.object({
  reminderId: z
    .string()
    .min(1)
    .describe('The ID of the reminder to cancel (from listReminders)'),
});

const cancelReminderTool: SandraTool = {
  name: 'cancelReminder',
  description:
    "Cancel a queued reminder. Use when the user says they no longer need a reminder or want to delete one. Use listReminders first to find the reminder ID.",
  parameters: {
    type: 'object',
    properties: {
      reminderId: { type: 'string', description: 'Reminder ID to cancel (from listReminders)' },
    },
    required: ['reminderId'],
  },
  inputSchema,
  requiredScopes: ['actions:submit'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to cancel reminders.' };
    }

    try {
      const action = await db.actionRequest.findFirst({
        where: {
          id: params.reminderId,
          userId,
          tool: 'queueReminder',
        },
      });

      if (!action) {
        return {
          success: false,
          data: null,
          error: `No reminder found with ID "${params.reminderId}" for your account.`,
        };
      }

      if (action.status === 'executed') {
        return {
          success: false,
          data: null,
          error: 'This reminder has already been delivered and cannot be cancelled.',
        };
      }

      await db.actionRequest.update({
        where: { id: params.reminderId },
        data: { status: 'rejected', reviewNote: 'Cancelled by user via chat' },
      });

      const actionInput = action.input as Record<string, unknown>;
      return {
        success: true,
        data: {
          confirmation: `Reminder cancelled: "${actionInput.message ?? '(message)'}"`,
          reminderId: params.reminderId,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to cancel reminder: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(cancelReminderTool);
export { cancelReminderTool };
