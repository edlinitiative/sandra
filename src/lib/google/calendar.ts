/**
 * Google Calendar — create and manage calendar events via the Calendar API.
 *
 * Uses domain-wide delegation to impersonate the calendar owner.
 * The impersonated user must have calendar access enabled on their account.
 *
 * Required DWD scope: https://www.googleapis.com/auth/calendar.events
 */

import { createLogger } from '@/lib/utils';
import { getContextToken, GOOGLE_SCOPES } from './auth';
import type { GoogleWorkspaceContext } from './types';

const log = createLogger('google:calendar');

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const CALENDAR_SCOPES = [GOOGLE_SCOPES.CALENDAR_EVENTS];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEventInput {
  /** Event title / summary */
  summary: string;
  /** Event description (optional) */
  description?: string;
  /** Event location (optional) */
  location?: string;
  /** Start datetime in ISO 8601 format, e.g. "2026-04-03T10:00:00" */
  startDateTime: string;
  /** End datetime in ISO 8601 format, e.g. "2026-04-03T11:00:00" */
  endDateTime: string;
  /** IANA timezone, e.g. "America/New_York". Defaults to UTC. */
  timeZone?: string;
  /** List of attendee email addresses */
  attendees?: string[];
  /** Whether to send invite notifications to attendees. Default: false */
  sendNotifications?: boolean;
  /** Attach a Google Meet video conference to the event */
  addGoogleMeet?: boolean;
  /** Calendar ID to create the event on. Default: 'primary' */
  calendarId?: string;
}

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string;
  /** Google Meet join URL, present only when addGoogleMeet was true */
  meetLink?: string;
  summary: string;
  startDateTime: string;
  endDateTime: string;
  calendarId: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a calendar event on a user's Google Calendar.
 *
 * @param ctx - Google Workspace context (impersonates the calendar owner)
 * @param input - Event details
 */
export async function createCalendarEvent(
  ctx: GoogleWorkspaceContext,
  input: CalendarEventInput,
): Promise<CalendarEventResult> {
  const calendarId = input.calendarId ?? 'primary';
  const timeZone = input.timeZone ?? 'UTC';

  log.info('Creating calendar event', {
    summary: input.summary,
    start: input.startDateTime,
    calendarId,
    impersonating: ctx.impersonateEmail,
  });

  const token = await getContextToken(ctx, CALENDAR_SCOPES);

  const body: Record<string, unknown> = {
    summary: input.summary,
    start: {
      dateTime: input.startDateTime,
      timeZone,
    },
    end: {
      dateTime: input.endDateTime,
      timeZone,
    },
  };

  if (input.description) body.description = input.description;
  if (input.location) body.location = input.location;
  if (input.attendees?.length) {
    body.attendees = input.attendees.map((email) => ({ email }));
  }
  if (input.addGoogleMeet) {
    // Request a new Google Meet conference — Google generates the join link
    body.conferenceData = {
      createRequest: {
        requestId: `sandra-meet-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
  if (input.sendNotifications) {
    url.searchParams.set('sendUpdates', 'all');
  }
  if (input.addGoogleMeet) {
    // Required for Google to actually generate the Meet link
    url.searchParams.set('conferenceDataVersion', '1');
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    log.error('Calendar event creation failed', { status: res.status, body: errBody });
    throw new Error(`Calendar API error: ${res.status} — ${errBody}`);
  }

  const data = await res.json() as {
    id: string;
    htmlLink: string;
    summary: string;
    start: { dateTime: string };
    end: { dateTime: string };
    conferenceData?: {
      entryPoints?: Array<{ entryPointType: string; uri: string }>;
    };
  };

  const meetLink = data.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === 'video',
  )?.uri;

  log.info('Calendar event created', { eventId: data.id, summary: data.summary, meetLink });

  return {
    eventId: data.id,
    htmlLink: data.htmlLink,
    meetLink,
    summary: data.summary,
    startDateTime: data.start.dateTime,
    endDateTime: data.end.dateTime,
    calendarId,
  };
}
