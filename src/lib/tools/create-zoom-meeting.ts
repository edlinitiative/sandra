/**
 * createZoomMeeting — schedule a Zoom meeting via the Zoom API.
 *
 * Uses Server-to-Server OAuth (no per-user auth required).
 * Requires Zoom to be connected via the admin panel first.
 *
 * Required scopes: zoom:meeting
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { resolveZoomContext, createZoomMeeting } from '@/lib/zoom';
import { resolveTenantForUser } from '@/lib/google/context';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

const inputSchema = z.object({
  topic: z
    .string()
    .min(1)
    .max(200)
    .describe('Meeting title/topic, e.g. "Weekly standup", "Project kickoff"'),
  startDateTime: z
    .string()
    .describe('Start date and time in ISO 8601 format, e.g. "2026-04-03T10:00:00"'),
  durationMinutes: z
    .number()
    .min(5)
    .max(1440)
    .default(60)
    .describe('Meeting duration in minutes. Default 60.'),
  timeZone: z
    .string()
    .optional()
    .describe('IANA timezone, e.g. "America/New_York". Infer from context or default to "America/New_York".'),
  agenda: z
    .string()
    .max(2000)
    .optional()
    .describe('Optional meeting agenda or description'),
  attendees: z
    .array(z.string().email())
    .max(20)
    .optional()
    .describe('Optional list of attendee email addresses to invite'),
});

const createZoomMeetingTool: SandraTool = {
  name: 'createZoomMeeting',
  description:
    "Schedule a Zoom meeting. Use when the user explicitly asks for a Zoom meeting or a Zoom link (as opposed to Google Meet). Extract the date, time, topic, and any attendees. If the user says 'today' or 'tomorrow', resolve relative to today's date. If no duration is given, default to 60 minutes. If attendees are mentioned, include their emails. Use listContacts first to look up emails for team members by name.",
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Meeting title/topic',
        maxLength: 200,
      },
      startDateTime: {
        type: 'string',
        description: 'Start in ISO 8601 format, e.g. "2026-04-03T10:00:00"',
      },
      durationMinutes: {
        type: 'number',
        description: 'Duration in minutes (default 60)',
        default: 60,
      },
      timeZone: {
        type: 'string',
        description: 'IANA timezone. Default "America/New_York".',
      },
      agenda: {
        type: 'string',
        description: 'Optional agenda or description',
        maxLength: 2000,
      },
      attendees: {
        type: 'array',
        items: { type: 'string', format: 'email' },
        description: 'Optional attendee emails to invite',
      },
    },
    required: ['topic', 'startDateTime'],
  },
  inputSchema,
  requiredScopes: ['zoom:meeting'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'You need to be signed in to create Zoom meetings.' };
    }

    const tenantId = await resolveTenantForUser(userId);
    if (!tenantId) {
      return {
        success: false,
        data: null,
        error: 'Your account is not linked to an organization. Say "my email is you@edlight.org" to link it.',
      };
    }

    let zoomCtx;
    try {
      zoomCtx = await resolveZoomContext(tenantId);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: err instanceof Error ? err.message : 'Zoom is not connected for your organization.',
      };
    }

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });

    try {
      const result = await createZoomMeeting(zoomCtx, {
        topic: params.topic,
        startDateTime: params.startDateTime,
        durationMinutes: params.durationMinutes ?? 60,
        timeZone: params.timeZone ?? 'America/New_York',
        agenda: params.agenda,
        attendees: params.attendees,
        // If the requesting user is in the org, try to make them the host
        hostEmail: user?.email ?? undefined,
      });

      await logAuditEvent({
        userId,
        sessionId: context.sessionId,
        action: 'data_access',
        resource: 'createZoomMeeting',
        details: {
          topic: params.topic,
          startDateTime: params.startDateTime,
          meetingId: result.meetingId,
          tenantId,
        },
        success: true,
      }).catch(() => {});

      const start = new Date(params.startDateTime);
      const tz = params.timeZone ?? 'America/New_York';
      const dateStr = start.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz,
      });
      const timeStr = start.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: tz,
      });

      const attendeeLine = params.attendees?.length
        ? ` Invites sent to: ${params.attendees.join(', ')}.`
        : '';

      return {
        success: true,
        data: {
          message: `Done — Zoom meeting "${params.topic}" scheduled for ${dateStr} at ${timeStr} (${params.durationMinutes ?? 60} min).${attendeeLine}\n\nJoin link: ${result.joinUrl}\nPasscode: ${result.password}`,
          joinUrl: result.joinUrl,
          password: result.password,
          meetingId: result.meetingId,
          topic: result.topic,
          startDateTime: result.startDateTime,
          durationMinutes: result.durationMinutes,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        data: null,
        error: `Couldn't create the Zoom meeting: ${message}`,
      };
    }
  },
};

toolRegistry.register(createZoomMeetingTool);
