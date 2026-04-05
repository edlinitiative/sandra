/**
 * Tests for createCalendarEvent tool.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveGoogleContext = vi.fn();
const mockResolveTenantForUser = vi.fn();
const mockCreateCalendarEvent = vi.fn();
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);
const mockFindUnique = vi.fn();

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext: (...a: unknown[]) => mockResolveGoogleContext(...a),
  resolveTenantForUser: (...a: unknown[]) => mockResolveTenantForUser(...a),
  resolveTenantForContext: (...a: unknown[]) => mockResolveTenantForUser(...a),
}));

vi.mock('@/lib/google/calendar', () => ({
  createCalendarEvent: (...a: unknown[]) => mockCreateCalendarEvent(...a),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: (...a: unknown[]) => mockFindUnique(...a) },
  },
}));

// ─── Import tool ──────────────────────────────────────────────────────────────

import '@/lib/tools/create-calendar-event';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ToolContext = { sessionId: 'sess-1', userId: 'user-1', scopes: ['calendar:write'] };
const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

const eventResult = {
  eventId: 'evt-123',
  htmlLink: 'https://calendar.google.com/event?eid=abc123',
  summary: 'Team standup',
  meetLink: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockFindUnique.mockResolvedValue({ email: 'rony@edlight.org', name: 'Rony' });
  mockResolveGoogleContext.mockResolvedValue({ impersonateEmail: 'rony@edlight.org', config: {} });
  mockCreateCalendarEvent.mockResolvedValue(eventResult);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createCalendarEvent', () => {
  const tool = toolRegistry.get('createCalendarEvent')!;

  it('is registered with calendar:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('calendar:write');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({
      summary: 'Test', startDateTime: '2026-04-10T10:00:00', endDateTime: '2026-04-10T11:00:00',
    }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('signed in');
  });

  it('returns error when no tenant linked', async () => {
    mockResolveTenantForUser.mockResolvedValue(null);
    const result = await tool.handler({
      summary: 'Test', startDateTime: '2026-04-10T10:00:00', endDateTime: '2026-04-10T11:00:00',
    }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not linked');
  });

  it('returns error when no email found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await tool.handler({
      summary: 'Test', startDateTime: '2026-04-10T10:00:00', endDateTime: '2026-04-10T11:00:00',
    }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('creates an event and returns event link', async () => {
    const result = await tool.handler({
      summary: 'Team standup',
      startDateTime: '2026-04-10T10:00:00',
      endDateTime: '2026-04-10T11:00:00',
    }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.eventId).toBe('evt-123');
    expect(data.summary).toBe('Team standup');
    expect((data.eventLink as string)).toContain('calendar.google.com');
    expect((data.eventLink as string)).toContain('authuser=rony%40edlight.org');
    expect((data.message as string)).toContain('Team standup');
  });

  it('passes Google Meet flag when requested', async () => {
    mockCreateCalendarEvent.mockResolvedValue({ ...eventResult, meetLink: 'https://meet.google.com/abc-def-ghi' });
    const result = await tool.handler({
      summary: 'Video call',
      startDateTime: '2026-04-10T10:00:00',
      endDateTime: '2026-04-10T11:00:00',
      addGoogleMeet: true,
    }, ctx);

    expect(result.success).toBe(true);
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ addGoogleMeet: true }),
    );
    const data = result.data as Record<string, unknown>;
    expect((data.message as string)).toContain('meet.google.com');
  });

  it('includes attendees line in message when provided', async () => {
    const result = await tool.handler({
      summary: 'Sprint review',
      startDateTime: '2026-04-10T10:00:00',
      endDateTime: '2026-04-10T11:00:00',
      attendees: ['ted@edlight.org'],
      sendNotifications: true,
    }, ctx);

    expect(result.success).toBe(true);
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ attendees: ['ted@edlight.org'], sendNotifications: true }),
    );
    const data = result.data as Record<string, unknown>;
    expect((data.message as string)).toContain('ted@edlight.org');
  });

  it('returns friendly error on 403 (scope not enabled)', async () => {
    mockCreateCalendarEvent.mockRejectedValue(new Error('HTTP 403: insufficient permission'));
    const result = await tool.handler({
      summary: 'Test', startDateTime: '2026-04-10T10:00:00', endDateTime: '2026-04-10T11:00:00',
    }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Domain-wide Delegation');
  });

  it('logs audit event on success', async () => {
    await tool.handler({
      summary: 'Audit test', startDateTime: '2026-04-10T10:00:00', endDateTime: '2026-04-10T11:00:00',
    }, ctx);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', resource: 'createCalendarEvent', success: true,
    }));
  });
});
