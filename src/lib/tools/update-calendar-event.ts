/**
 * updateCalendarEvent — edit an existing event on the user's Google Calendar.
 *
 * Required scopes: calendar:write
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForContext } from '@/lib/google/context';
import { updateCalendarEvent } from '@/lib/google/calendar';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  eventId: z
    .string()
    .min(1)
    .describe('The Google Calendar event ID to update'),
  summary: z
    .string()
    .max(200)
    .optional()
    .describe('New event title (leave blank to keep existing)'),
  startDateTime: z
    .string()
    .optional()
    .describe('New start date and time in ISO 8601 format'),
  endDateTime: z
    .string()
    .optional()
    .describe('New end date and time in ISO 8601 format'),
  timeZone: z
    .string()
    .optional()
    .describe('IANA timezone, e.g. "America/New_York"'),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe('New event description or notes'),
  location: z
    .string()
    .max(300)
    .optional()
    .describe('New event location or address'),
  attendees: z
    .array(z.string().email())
    .max(20)
    .optional()
    .describe('Replace the attendee list with these email addresses'),
  sendNotifications: z
    .boolean()
    .optional()
    .default(false)
    .describe('Send update notifications to attendees'),
});

const updateCalendarEventTool: SandraTool = {
  name: 'updateCalendarEvent',
  description:
    "Update (reschedule, rename, or edit) an existing event on the user's Google Calendar. Use when the user says 'move', 'reschedule', 'change', 'update', or 'edit' an existing meeting or appointment. You will need the event ID — first call listCalendarEvents to find it if not provided.",
  parameters: {
    type: 'object',
    properties: {
      eventId: { type: 'string', description: 'Google Calendar event ID to update' },
      summary: { type: 'string', description: 'New event title', maxLength: 200 },
      startDateTime: { type: 'string', description: 'New start (ISO 8601)' },
      endDateTime: { type: 'string', description: 'New end (ISO 8601)' },
      timeZone: { type: 'string', description: 'IANA timezone' },
      description: { type: 'string', description: 'New description', maxLength: 2000 },
      location: { type: 'string', description: 'New location', maxLength: 300 },
      attendees: { type: 'array', items: { type: 'string', format: 'email' }, description: 'Replacement attendee list' },
      sendNotifications: { type: 'boolean', description: 'Email update notifications to attendees', default: false },
    },
    required: ['eventId'],
  },
  inputSchema,
  requiredScopes: ['calendar:write'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to update calendar events.' };
    }

    const tenantId = await resolveTenantForContext(userId, context.workspaceEmail);
    if (!tenantId) {
      return { success: false, data: null, error: 'You are not a member of any organization with Google Calendar access.' };
    }

    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      const userEmail = user?.email ?? context.workspaceEmail ?? null;
      if (!userEmail) {
        return { success: false, data: null, error: 'No email address associated with your account.' };
      }

      const ctx = await resolveGoogleContext(tenantId, userEmail);
      const { eventId, ...updates } = params;
      const result = await updateCalendarEvent(ctx, eventId, updates);

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'admin_action',
        resource: 'updateCalendarEvent',
        details: { eventId, tenantId },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          confirmation: `Event updated: "${result.summary}" — ${result.htmlLink}`,
          event: result,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to update calendar event: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(updateCalendarEventTool);
export { updateCalendarEventTool };
