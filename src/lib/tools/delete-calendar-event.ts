/**
 * deleteCalendarEvent — cancel / delete an event from the user's Google Calendar.
 *
 * Required scopes: calendar:write
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { deleteCalendarEvent } from '@/lib/google/calendar';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  eventId: z
    .string()
    .min(1)
    .describe('The Google Calendar event ID to delete/cancel'),
  sendNotifications: z
    .boolean()
    .optional()
    .default(false)
    .describe('Send cancellation notifications to attendees'),
});

const deleteCalendarEventTool: SandraTool = {
  name: 'deleteCalendarEvent',
  description:
    "Delete or cancel an event on the user's Google Calendar. Use when the user says 'cancel', 'delete', or 'remove' a meeting or appointment. You will need the event ID — first call listCalendarEvents to find it if not provided.",
  parameters: {
    type: 'object',
    properties: {
      eventId: { type: 'string', description: 'Google Calendar event ID to delete' },
      sendNotifications: { type: 'boolean', description: 'Send cancellation notices to attendees', default: false },
    },
    required: ['eventId'],
  },
  inputSchema,
  requiredScopes: ['calendar:write'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to delete calendar events.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Google Calendar access.' };
    }

    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user?.email) {
        return { success: false, data: null, error: 'No email address associated with your account.' };
      }

      const ctx = await resolveGoogleContext(tenantId, user.email);
      await deleteCalendarEvent(ctx, params.eventId);

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'admin_action',
        resource: 'deleteCalendarEvent',
        details: { eventId: params.eventId, tenantId },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          confirmation: `Event has been cancelled and removed from your calendar.`,
          eventId: params.eventId,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to delete calendar event: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(deleteCalendarEventTool);
export { deleteCalendarEventTool };
