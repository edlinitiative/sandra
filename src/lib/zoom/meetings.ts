/**
 * Zoom Meetings API — create scheduled meetings.
 *
 * Uses Server-to-Server OAuth (no per-user auth required).
 * The host is the Zoom user configured in ConnectedProvider.config.defaultHostEmail.
 */

import { createLogger } from '@/lib/utils';
import { getZoomToken } from './auth';
import type { ZoomContext, ZoomMeetingInput, ZoomMeetingResult } from './types';

const log = createLogger('zoom:meetings');

const ZOOM_API = 'https://api.zoom.us/v2';

/**
 * Create a Zoom meeting and return the join/start URLs.
 */
export async function createZoomMeeting(
  ctx: ZoomContext,
  input: ZoomMeetingInput,
): Promise<ZoomMeetingResult> {
  const token = await getZoomToken(ctx.tenantId, ctx.credentials);
  const hostEmail = input.hostEmail ?? ctx.config.defaultHostEmail;

  log.info('Creating Zoom meeting', {
    topic: input.topic,
    start: input.startDateTime,
    host: hostEmail,
    tenantId: ctx.tenantId,
  });

  const body: Record<string, unknown> = {
    topic: input.topic,
    type: 2, // Scheduled meeting
    start_time: input.startDateTime,
    duration: input.durationMinutes,
    timezone: input.timeZone ?? 'America/New_York',
    agenda: input.agenda ?? '',
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      waiting_room: true,
      // Send email invitations to attendees if provided
      ...(input.attendees?.length ? {
        registrants_email_notification: true,
      } : {}),
    },
  };

  const res = await fetch(`${ZOOM_API}/users/${encodeURIComponent(hostEmail)}/meetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    log.error('Zoom meeting creation failed', { status: res.status, body: errBody });
    throw new Error(`Zoom API error: ${res.status} — ${errBody}`);
  }

  const data = await res.json() as {
    id: number;
    topic: string;
    join_url: string;
    start_url: string;
    password: string;
    start_time: string;
    duration: number;
  };

  // If attendees provided, add them as meeting invitees
  if (input.attendees?.length) {
    await addMeetingInvitees(token, data.id, input.attendees).catch((err) => {
      // Non-fatal — meeting was created, invites just didn't send
      log.warn('Failed to add Zoom invitees', { meetingId: data.id, error: String(err) });
    });
  }

  log.info('Zoom meeting created', { meetingId: data.id, topic: data.topic });

  return {
    meetingId: data.id,
    topic: data.topic,
    joinUrl: data.join_url,
    startUrl: data.start_url,
    password: data.password,
    startDateTime: data.start_time,
    durationMinutes: data.duration,
  };
}

/**
 * Add invitees to a Zoom meeting (they receive email invitations).
 */
async function addMeetingInvitees(
  token: string,
  meetingId: number,
  emails: string[],
): Promise<void> {
  const invitees = emails.map((email) => ({ email }));

  const res = await fetch(`${ZOOM_API}/meetings/${meetingId}/invite_links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ attendees: invitees, ttl: 7200 }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom invite links failed: ${res.status} — ${body}`);
  }
}
