/**
 * Zoom integration types.
 *
 * Credentials are stored in ConnectedProvider.credentials (Server-to-Server OAuth app).
 * Config is stored in ConnectedProvider.config.
 *
 * To set up:
 * 1. Go to marketplace.zoom.us → Develop → Build App → Server-to-Server OAuth
 * 2. Add scopes: meeting:write:admin, meeting:write
 * 3. Copy Account ID, Client ID, Client Secret into ConnectedProvider.credentials
 * 4. Set defaultHostEmail in config to the Zoom user who will host meetings
 */

export interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
}

export interface ZoomConfig {
  /** Email of the Zoom user to host meetings (must exist in the Zoom account) */
  defaultHostEmail: string;
}

export interface ZoomContext {
  tenantId: string;
  credentials: ZoomCredentials;
  config: ZoomConfig;
}

export interface ZoomMeetingInput {
  topic: string;
  startDateTime: string; // ISO 8601
  durationMinutes: number;
  timeZone?: string;
  agenda?: string;
  /** Attendee emails to receive the meeting invitation */
  attendees?: string[];
  /** Host email override (falls back to config.defaultHostEmail) */
  hostEmail?: string;
}

export interface ZoomMeetingResult {
  meetingId: number;
  topic: string;
  joinUrl: string;
  startUrl: string;
  password: string;
  startDateTime: string;
  durationMinutes: number;
}
