/**
 * createTask — add a task to the user's Google Tasks.
 *
 * Tasks appear in the Google Calendar sidebar ("My Tasks") and the
 * Google Tasks app. Ideal for action items from meetings.
 *
 * Required scopes: tasks:write
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { createTask } from '@/lib/google/tasks';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('Task title, e.g. "Review proposal", "Follow up with team"'),
  notes: z
    .string()
    .max(1000)
    .optional()
    .describe('Optional details or notes for the task'),
  dueDate: z
    .string()
    .optional()
    .describe('Due date in YYYY-MM-DD format, e.g. "2026-04-05". Resolve relative dates like "tomorrow" or "Friday" using today\'s date.'),
  assignTo: z
    .string()
    .email()
    .optional()
    .describe('Email of the person to assign the task to. If omitted, the task is created for the requesting user.'),
});

const createTaskTool: SandraTool = {
  name: 'createTask',
  description:
    "Add a task or action item to Google Tasks (visible in Google Calendar sidebar). Use when the user asks to create a task, action item, to-do, reminder, or follow-up. Extract the title and optional due date. If the user says 'assign to [name]', look up their email with listContacts first, then pass it as 'assignTo'. Tasks assigned to others are created on their Google Tasks list.",
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Task title',
        maxLength: 200,
      },
      notes: {
        type: 'string',
        description: 'Optional task details or notes',
        maxLength: 1000,
      },
      dueDate: {
        type: 'string',
        description: 'Due date in YYYY-MM-DD format. Resolve relative dates using today\'s date.',
      },
      assignTo: {
        type: 'string',
        format: 'email',
        description: 'Email of the person to assign the task to. Omit to assign to yourself.',
      },
    },
    required: ['title'],
  },
  inputSchema,
  requiredScopes: ['tasks:write'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'You need to be signed in to create tasks.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return {
        success: false,
        data: null,
        error: 'Your account is not linked to a Workspace. Say "my email is you@edlight.org" to link it.',
      };
    }

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    const userEmail = user?.email ?? null;
    if (!userEmail) {
      return {
        success: false,
        data: null,
        error: 'No email address found. Say "my email is you@edlight.org" first.',
      };
    }

    // If assigning to someone else, impersonate them; otherwise impersonate self
    const targetEmail = params.assignTo ?? userEmail;

    try {
      const ctx = await resolveGoogleContext(tenantId, targetEmail);
      const result = await createTask(ctx, {
        title: params.title,
        notes: params.notes,
        dueDate: params.dueDate,
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'createTask',
        details: { title: params.title, assignTo: targetEmail, dueDate: params.dueDate, tenantId },
        success: true,
      }).catch(() => {});

      const assignLine = params.assignTo
        ? ` Assigned to ${params.assignTo}.`
        : '';
      const dueStr = result.dueDate
        ? ` Due: ${new Date(result.dueDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`
        : '';

      return {
        success: true,
        data: {
          message: `Done — task "${result.title}" added to Google Tasks.${assignLine}${dueStr} It will appear in the Google Calendar sidebar.`,
          taskId: result.taskId,
          title: result.title,
          dueDate: result.dueDate,
          assignedTo: targetEmail,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('403')) {
        return {
          success: false,
          data: null,
          error: 'Tasks access is not yet enabled. An admin needs to grant the Tasks API scope in Google Admin Console under Domain-wide Delegation.',
        };
      }

      return {
        success: false,
        data: null,
        error: `Couldn't create the task: ${message}`,
      };
    }
  },
};

toolRegistry.register(createTaskTool);
