/**
 * createCalendarEvent — add an event to the user's Google Calendar.
 *
 * Works by impersonating the user's Workspace account via domain-wide
 * delegation. Requires the user to be linked to a Workspace identity.
 *
 * Required scopes: calendar:write
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveGoogleContext, resolveTenantForContext } from '@/lib/google/context';
import { createCalendarEvent } from '@/lib/google/calendar';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  summary: z
    .string()
    .min(1)
    .max(200)
    .describe('Event title, e.g. "Tennis class", "Team standup"'),
  startDateTime: z
    .string()
    .describe('Start date and time in ISO 8601 format, e.g. "2026-04-03T10:00:00"'),
  endDateTime: z
    .string()
    .describe('End date and time in ISO 8601 format, e.g. "2026-04-03T11:00:00"'),
  timeZone: z
    .string()
    .optional()
    .describe('IANA timezone, e.g. "America/New_York", "America/Port-au-Prince". Infer from context or default to "America/New_York".'),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe('Optional event description or notes'),
  location: z
    .string()
    .max(300)
    .optional()
    .describe('Optional location or address'),
  attendees: z
    .array(z.string().email())
    .max(20)
    .optional()
    .describe('Optional list of attendee email addresses to invite'),
  sendNotifications: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to email invitations to attendees. Default false.'),
  addGoogleMeet: z
    .boolean()
    .optional()
    .default(false)
    .describe('Attach a Google Meet video link to the event. Set true when the user asks for a video call, online meeting, or Zoom-style link.'),
});

const createCalendarEventTool: SandraTool = {
  name: 'createCalendarEvent',
  description:
    "Create an event on the user's Google Calendar. Use when the user asks to schedule, add, book, or create a meeting, class, appointment, reminder, or any event. Extract the date, time, title, and any attendees from the message. If the user says 'today' or 'tomorrow', resolve the date relative to today's date. If no end time is given, default to 1 hour after the start. If the user mentions inviting people or attendees, include their emails in 'attendees' and set 'sendNotifications' to true so they receive email invitations. If the user asks for a video call, Zoom link, Google Meet, or online meeting, set 'addGoogleMeet' to true to attach a Google Meet link.",
  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'Event title, e.g. "Tennis class", "Team standup"',
        maxLength: 200,
      },
      startDateTime: {
        type: 'string',
        description: 'Start in ISO 8601 format, e.g. "2026-04-03T10:00:00"',
      },
      endDateTime: {
        type: 'string',
        description: 'End in ISO 8601 format. Default to 1 hour after start if not specified.',
      },
      timeZone: {
        type: 'string',
        description: 'IANA timezone. Default "America/New_York".',
      },
      description: {
        type: 'string',
        description: 'Optional event description or notes',
        maxLength: 2000,
      },
      location: {
        type: 'string',
        description: 'Optional location or address',
        maxLength: 300,
      },
      attendees: {
        type: 'array',
        items: { type: 'string', format: 'email' },
        description: 'Optional attendee emails to invite',
      },
      sendNotifications: {
        type: 'boolean',
        description: 'Send email invitations to attendees. Default false.',
      },
      addGoogleMeet: {
        type: 'boolean',
        description: 'Attach a Google Meet video conference link. Set true when user asks for a video call, online meeting, or Zoom-style link.',
      },
    },
    required: ['summary', 'startDateTime', 'endDateTime'],
  },
  inputSchema,
  requiredScopes: ['calendar:write'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'You need to be signed in to create calendar events.' };
    }

    const tenantId = await resolveTenantForContext(userId, context.workspaceEmail);
    if (!tenantId) {
      return {
        success: false,
        data: null,
        error: 'Your account is not linked to a Workspace. Say "my email is you@edlight.org" to link it.',
      };
    }

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    const userEmail = user?.email ?? context.workspaceEmail ?? null;
    if (!userEmail) {
      return {
        success: false,
        data: null,
        error: 'No email address found. Say "my email is you@edlight.org" to link your account first.',
      };
    }

    try {
      // Impersonate the user so the event lands on their own calendar
      const ctx = await resolveGoogleContext(tenantId, userEmail);

      const result = await createCalendarEvent(ctx, {
        summary: params.summary,
        startDateTime: params.startDateTime,
        endDateTime: params.endDateTime,
        timeZone: params.timeZone ?? 'America/New_York',
        description: params.description,
        location: params.location,
        attendees: params.attendees,
        sendNotifications: params.sendNotifications ?? false,
        addGoogleMeet: params.addGoogleMeet ?? false,
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'createCalendarEvent',
        details: {
          summary: params.summary,
          startDateTime: params.startDateTime,
          eventId: result.eventId,
          tenantId,
          calendarOwner: userEmail,
        },
        success: true,
      }).catch(() => {});

      // Format a human-readable time for the confirmation message
      const start = new Date(params.startDateTime);
      const end = new Date(params.endDateTime);
      const tz = params.timeZone ?? 'America/New_York';
      const fmt = (d: Date) =>
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
      const dateStr = start.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: tz,
      });

      // Ensure link opens in the correct account (avoids /u/0/ wrong-account redirect)
      const eventLink = (() => {
        try {
          const url = new URL(result.htmlLink);
          url.searchParams.set('authuser', userEmail);
          return url.toString();
        } catch {
          return result.htmlLink;
        }
      })();

      const attendeeLine = params.attendees?.length
        ? ` Invites sent to: ${params.attendees.join(', ')}.`
        : '';
      const meetLine = result.meetLink ? ` Google Meet: ${result.meetLink}` : '';

      return {
        success: true,
        data: {
          message: `Done — "${params.summary}" added to your calendar for ${dateStr} from ${fmt(start)} to ${fmt(end)}.${attendeeLine}${meetLine} Open it here: ${eventLink}`,
          eventLink,
          eventId: result.eventId,
          htmlLink: result.htmlLink,
          summary: params.summary,
          startDateTime: params.startDateTime,
          endDateTime: params.endDateTime,
          calendarOwner: userEmail,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Give a helpful hint if it's a 403 (Calendar scope not yet enabled in DWD)
      if (message.includes('403')) {
        return {
          success: false,
          data: null,
          error: 'Calendar access is not yet enabled for your Workspace. A Super Admin needs to grant the Calendar API scope in Google Admin Console under Domain-wide Delegation.',
        };
      }

      return {
        success: false,
        data: null,
        error: `Couldn't create the calendar event: ${message}`,
      };
    }
  },
};

toolRegistry.register(createCalendarEventTool);
