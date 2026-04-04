import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);

vi.mock('../auth', () => ({
  getContextToken: vi.fn().mockResolvedValue('ya29.mock-token'),
  GOOGLE_SCOPES: {
    CALENDAR: 'https://www.googleapis.com/auth/calendar',
    CALENDAR_EVENTS: 'https://www.googleapis.com/auth/calendar.events',
  },
}));

vi.mock('@/lib/utils', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCtx(): import('../types').GoogleWorkspaceContext {
  return {
    tenantId: 'tenant-1',
    providerId: 'provider-1',
    impersonateEmail: 'ted.jacquet@edlight.org',
    credentials: {
      type: 'service_account' as const,
      client_email: 'sa@project.iam.gserviceaccount.com',
      private_key: 'fake-key',
      token_uri: 'https://oauth2.googleapis.com/token',
    },
    config: {
      domain: 'edlight.org',
      adminEmail: 'sandra@edlight.org',
      directoryAdminEmail: 'ted.jacquet@edlight.org',
      grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
    },
  };
}

function makeEventResponse() {
  return {
    id: 'event-abc123',
    htmlLink: 'https://calendar.google.com/event?eid=abc123',
    summary: 'Tennis class',
    start: { dateTime: '2026-04-03T10:00:00-04:00' },
    end: { dateTime: '2026-04-03T11:00:00-04:00' },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('createCalendarEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an event and returns the result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeEventResponse(),
    });

    const { createCalendarEvent } = await import('../calendar');
    const result = await createCalendarEvent(makeCtx(), {
      summary: 'Tennis class',
      startDateTime: '2026-04-03T10:00:00',
      endDateTime: '2026-04-03T11:00:00',
      timeZone: 'America/New_York',
    });

    expect(result.eventId).toBe('event-abc123');
    expect(result.summary).toBe('Tennis class');
    expect(result.htmlLink).toContain('calendar.google.com');
    expect(result.calendarId).toBe('primary');
  });

  it('POSTs to the Calendar API with correct headers', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => makeEventResponse() });

    const { createCalendarEvent } = await import('../calendar');
    await createCalendarEvent(makeCtx(), {
      summary: 'Team standup',
      startDateTime: '2026-04-03T09:00:00',
      endDateTime: '2026-04-03T09:30:00',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain('www.googleapis.com/calendar/v3');
    expect(url).toContain('/calendars/primary/events');
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer ya29.mock-token');
    expect(options.method).toBe('POST');
  });

  it('includes attendees in the request body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => makeEventResponse() });

    const { createCalendarEvent } = await import('../calendar');
    await createCalendarEvent(makeCtx(), {
      summary: 'Meeting',
      startDateTime: '2026-04-03T14:00:00',
      endDateTime: '2026-04-03T15:00:00',
      attendees: ['rony@edlight.org', 'fredler@edlight.org'],
    });

    const [, options] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { attendees: { email: string }[] };
    expect(body.attendees).toHaveLength(2);
    expect(body.attendees[0]).toEqual({ email: 'rony@edlight.org' });
  });

  it('sets sendUpdates=all when sendNotifications is true', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => makeEventResponse() });

    const { createCalendarEvent } = await import('../calendar');
    await createCalendarEvent(makeCtx(), {
      summary: 'Workshop',
      startDateTime: '2026-04-04T09:00:00',
      endDateTime: '2026-04-04T10:00:00',
      sendNotifications: true,
    });

    const [url] = mockFetch.mock.calls[0]! as [string];
    expect(url).toContain('sendUpdates=all');
  });

  it('does NOT add sendUpdates when sendNotifications is false', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => makeEventResponse() });

    const { createCalendarEvent } = await import('../calendar');
    await createCalendarEvent(makeCtx(), {
      summary: 'Solo task',
      startDateTime: '2026-04-04T09:00:00',
      endDateTime: '2026-04-04T10:00:00',
      sendNotifications: false,
    });

    const [url] = mockFetch.mock.calls[0]! as [string];
    expect(url).not.toContain('sendUpdates');
  });

  it('uses a custom calendarId when provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...makeEventResponse() }) });

    const { createCalendarEvent } = await import('../calendar');
    const result = await createCalendarEvent(makeCtx(), {
      summary: 'Board meeting',
      startDateTime: '2026-04-10T09:00:00',
      endDateTime: '2026-04-10T10:00:00',
      calendarId: 'team@edlight.org',
    });

    expect(result.calendarId).toBe('team@edlight.org');
    const [url] = mockFetch.mock.calls[0]! as [string];
    expect(url).toContain(encodeURIComponent('team@edlight.org'));
  });

  it('throws an error on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => '{"error":{"code":403,"message":"Not Authorized"}}',
    });

    const { createCalendarEvent } = await import('../calendar');
    await expect(
      createCalendarEvent(makeCtx(), {
        summary: 'Test event',
        startDateTime: '2026-04-03T10:00:00',
        endDateTime: '2026-04-03T11:00:00',
      }),
    ).rejects.toThrow('Calendar API error: 403');
  });

  it('includes description and location in the event body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => makeEventResponse() });

    const { createCalendarEvent } = await import('../calendar');
    await createCalendarEvent(makeCtx(), {
      summary: 'Tennis class',
      startDateTime: '2026-04-03T10:00:00',
      endDateTime: '2026-04-03T11:00:00',
      description: 'Advanced serve techniques',
      location: 'Stade Sylvio Cator',
    });

    const [, options] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { description: string; location: string };
    expect(body.description).toBe('Advanced serve techniques');
    expect(body.location).toBe('Stade Sylvio Cator');
  });
});
