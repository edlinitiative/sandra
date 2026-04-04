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
// ─── List / Update / Delete ──────────────────────────────────────────────────

export interface CalendarListOptions {
  /** Calendar ID — defaults to 'primary' */
  calendarId?: string;
  /** Return at most this many events */
  maxResults?: number;
  /** RFC 3339 lower bound (inclusive) for event start times */
  timeMin?: string;
  /** RFC 3339 upper bound (exclusive) for event end times */
  timeMax?: string;
  /** 'startTime' or 'updated' — only valid when singleEvents=true */
  orderBy?: 'startTime' | 'updated';
  /** Expand recurring events into single instances */
  singleEvents?: boolean;
  /** Free-text query to filter events */
  q?: string;
}

export interface CalendarEvent {
  eventId: string;
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  htmlLink: string;
  organizer?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  meetLink?: string;
  status?: string;
}

/**
 * List events from a user's Google Calendar.
 */
export async function listCalendarEvents(
  ctx: GoogleWorkspaceContext,
  options: CalendarListOptions = {},
): Promise<{ events: CalendarEvent[]; nextPageToken?: string }> {
  const calendarId = options.calendarId ?? 'primary';

  log.info('Listing calendar events', { calendarId, impersonating: ctx.impersonateEmail });

  const token = await getContextToken(ctx, CALENDAR_SCOPES);
  const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
  if (options.maxResults) url.searchParams.set('maxResults', String(options.maxResults));
  if (options.timeMin) url.searchParams.set('timeMin', options.timeMin);
  if (options.timeMax) url.searchParams.set('timeMax', options.timeMax);
  if (options.orderBy) url.searchParams.set('orderBy', options.orderBy);
  if (options.singleEvents !== false) url.searchParams.set('singleEvents', 'true');
  if (options.q) url.searchParams.set('q', options.q);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendar list failed: ${res.status} — ${body}`);
  }

  const data = await res.json() as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      status?: string;
      htmlLink: string;
      organizer?: { email?: string };
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
      conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> };
    }>;
    nextPageToken?: string;
  };

  const events: CalendarEvent[] = (data.items ?? []).map((item) => ({
    eventId: item.id,
    summary: item.summary ?? '(No title)',
    description: item.description,
    location: item.location,
    status: item.status,
    startDateTime: item.start.dateTime ?? item.start.date ?? '',
    endDateTime: item.end.dateTime ?? item.end.date ?? '',
    htmlLink: item.htmlLink,
    organizer: item.organizer?.email,
    attendees: item.attendees,
    meetLink: item.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri,
  }));

  return { events, nextPageToken: data.nextPageToken };
}

/**
 * Update an existing calendar event (patch — only supplied fields are changed).
 */
export async function updateCalendarEvent(
  ctx: GoogleWorkspaceContext,
  eventId: string,
  input: Partial<CalendarEventInput>,
): Promise<CalendarEventResult> {
  const calendarId = input.calendarId ?? 'primary';
  const timeZone = input.timeZone ?? 'UTC';

  log.info('Updating calendar event', { eventId, calendarId, impersonating: ctx.impersonateEmail });

  const token = await getContextToken(ctx, CALENDAR_SCOPES);

  const body: Record<string, unknown> = {};
  if (input.summary) body.summary = input.summary;
  if (input.description !== undefined) body.description = input.description;
  if (input.location !== undefined) body.location = input.location;
  if (input.startDateTime) body.start = { dateTime: input.startDateTime, timeZone };
  if (input.endDateTime) body.end = { dateTime: input.endDateTime, timeZone };
  if (input.attendees?.length) body.attendees = input.attendees.map((e) => ({ email: e }));

  const url = new URL(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
  );
  if (input.sendNotifications) url.searchParams.set('sendUpdates', 'all');

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Calendar update failed: ${res.status} — ${errBody}`);
  }

  const data = await res.json() as {
    id: string;
    htmlLink: string;
    summary: string;
    start: { dateTime: string };
    end: { dateTime: string };
    conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> };
  };

  const meetLink = data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri;
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

/**
 * Delete (cancel) a calendar event.
 */
export async function deleteCalendarEvent(
  ctx: GoogleWorkspaceContext,
  eventId: string,
  calendarId = 'primary',
): Promise<void> {
  log.info('Deleting calendar event', { eventId, calendarId, impersonating: ctx.impersonateEmail });

  const token = await getContextToken(ctx, CALENDAR_SCOPES);
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok && res.status !== 204 && res.status !== 410) {
    const errBody = await res.text();
    throw new Error(`Calendar delete failed: ${res.status} — ${errBody}`);
  }
  log.info('Calendar event deleted', { eventId });
}

// ─── Create ───────────────────────────────────────────────────────────────────

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
