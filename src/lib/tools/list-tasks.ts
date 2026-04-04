/**
 * listTasks — list the user's Google Tasks.
 *
 * Required scopes: tasks:write
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { listTasks } from '@/lib/google/tasks';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  showCompleted: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include completed tasks (default: false — only active tasks)'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Maximum number of tasks to return'),
});

const listTasksTool: SandraTool = {
  name: 'listTasks',
  description:
    "List the user's Google Tasks (to-dos). Use when the user asks to see their tasks, what they need to do, their to-do list, or upcoming tasks from Google Tasks.",
  parameters: {
    type: 'object',
    properties: {
      showCompleted: { type: 'boolean', description: 'Include completed tasks', default: false },
      maxResults: { type: 'number', description: 'Max tasks to return (default 20)', default: 20 },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['tasks:write'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to view Google Tasks.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Google Tasks access.' };
    }

    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user?.email) {
        return { success: false, data: null, error: 'No email address associated with your account.' };
      }

      const ctx = await resolveGoogleContext(tenantId, user.email);
      const tasks = await listTasks(ctx, {
        showCompleted: params.showCompleted,
        maxResults: params.maxResults,
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'listTasks',
        details: { count: tasks.length, tenantId },
        success: true,
      }).catch(() => {});

      if (tasks.length === 0) {
        return {
          success: true,
          data: {
            message: "You don't have any active tasks. Use createTask to add one!",
            tasks: [],
          },
        };
      }

      return {
        success: true,
        data: {
          message: `You have ${tasks.length} task(s).`,
          count: tasks.length,
          tasks,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to list tasks: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(listTasksTool);
export { listTasksTool };
