/**
 * listCalendarEvents — read upcoming events from the user's Google Calendar.
 *
 * Required scopes: calendar:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForUser } from '@/lib/google/context';
import { listCalendarEvents } from '@/lib/google/calendar';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum number of events to return (default 10)'),
  timeMin: z
    .string()
    .optional()
    .describe('Show events starting after this ISO 8601 datetime. Defaults to now.'),
  timeMax: z
    .string()
    .optional()
    .describe('Show events starting before this ISO 8601 datetime. E.g. end of week.'),
  query: z
    .string()
    .optional()
    .describe('Optional text query to filter events by title or description'),
});

const listCalendarEventsTool: SandraTool = {
  name: 'listCalendarEvents',
  description:
    "List the user's upcoming Google Calendar events. Use when the user asks what's on their calendar, what meetings they have, or for their schedule. Returns event titles, dates, times, location, and Google Meet links.",
  parameters: {
    type: 'object',
    properties: {
      maxResults: { type: 'number', description: 'Max events to return (default 10)', default: 10 },
      timeMin: { type: 'string', description: 'Start of range (ISO 8601). Defaults to now.' },
      timeMax: { type: 'string', description: 'End of range (ISO 8601). E.g. end of this week.' },
      query: { type: 'string', description: 'Text filter for event titles/descriptions' },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['calendar:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required to access your calendar.' };
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

      const timeMin = params.timeMin ?? new Date().toISOString();
      const result = await listCalendarEvents(ctx, {
        maxResults: params.maxResults,
        timeMin,
        timeMax: params.timeMax,
        orderBy: 'startTime',
        singleEvents: true,
        q: params.query,
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'listCalendarEvents',
        details: { resultCount: result.events.length, tenantId },
        success: true,
      }).catch(() => {});

      if (result.events.length === 0) {
        return {
          success: true,
          data: {
            message: 'No upcoming events found in the requested time range.',
            events: [],
          },
        };
      }

      return {
        success: true,
        data: {
          message: `Found ${result.events.length} upcoming event(s).`,
          events: result.events,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to list calendar events: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(listCalendarEventsTool);
export { listCalendarEventsTool };
