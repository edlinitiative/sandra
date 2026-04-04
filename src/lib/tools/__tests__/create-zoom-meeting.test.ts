/**
 * Tests for createZoomMeeting tool.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveZoomContext = vi.fn();
const mockCreateZoomMeeting = vi.fn();
const mockResolveTenantForUser = vi.fn();
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);
const mockFindUnique = vi.fn();

vi.mock('@/lib/zoom', () => ({
  resolveZoomContext: (...a: unknown[]) => mockResolveZoomContext(...a),
  createZoomMeeting: (...a: unknown[]) => mockCreateZoomMeeting(...a),
}));

vi.mock('@/lib/google/context', () => ({
  resolveTenantForUser: (...a: unknown[]) => mockResolveTenantForUser(...a),
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

import '@/lib/tools/create-zoom-meeting';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ToolContext = { sessionId: 'sess-1', userId: 'user-1', scopes: ['zoom:meeting'] };
const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

const zoomCtx = {
  config: { defaultHostEmail: 'admin@edlight.org' },
  tenantId: 'tenant-1',
};

const meetingResult = {
  joinUrl: 'https://zoom.us/j/123',
  password: 'abc123',
  meetingId: 123456,
  topic: 'Weekly standup',
  startDateTime: '2026-04-10T10:00:00',
  durationMinutes: 60,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockResolveZoomContext.mockResolvedValue(zoomCtx);
  mockFindUnique.mockResolvedValue({ email: 'rony@edlight.org' });
  mockCreateZoomMeeting.mockResolvedValue(meetingResult);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createZoomMeeting', () => {
  const tool = toolRegistry.get('createZoomMeeting')!;

  it('is registered with zoom:meeting scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('zoom:meeting');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ topic: 'Test', startDateTime: '2026-04-10T10:00:00' }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('signed in');
  });

  it('returns error when no tenant linked', async () => {
    mockResolveTenantForUser.mockResolvedValue(null);
    const result = await tool.handler({ topic: 'Test', startDateTime: '2026-04-10T10:00:00' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not linked');
  });

  it('creates a meeting and returns join link', async () => {
    const result = await tool.handler({
      topic: 'Weekly standup',
      startDateTime: '2026-04-10T10:00:00',
      durationMinutes: 60,
    }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.joinUrl).toBe('https://zoom.us/j/123');
    expect(data.password).toBe('abc123');
    expect(data.meetingId).toBe(123456);
    expect((data.message as string)).toContain('Weekly standup');
    expect(mockCreateZoomMeeting).toHaveBeenCalledWith(zoomCtx, expect.objectContaining({
      topic: 'Weekly standup',
      hostEmail: 'rony@edlight.org',
    }));
  });

  it('falls back to default host on error 1001', async () => {
    mockCreateZoomMeeting
      .mockRejectedValueOnce(new Error('Zoom error 1001: user not in account'))
      .mockResolvedValueOnce(meetingResult);

    const result = await tool.handler({
      topic: 'Fallback test',
      startDateTime: '2026-04-10T10:00:00',
    }, ctx);

    expect(result.success).toBe(true);
    expect(mockCreateZoomMeeting).toHaveBeenCalledTimes(2);
    // Second call should use default host
    expect(mockCreateZoomMeeting.mock.calls[1][1]).toMatchObject({
      hostEmail: 'admin@edlight.org',
    });
  });

  it('returns error when Zoom not connected', async () => {
    mockResolveZoomContext.mockRejectedValue(new Error('Zoom is not connected'));
    const result = await tool.handler({ topic: 'Test', startDateTime: '2026-04-10T10:00:00' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Zoom is not connected');
  });

  it('includes attendees in the call when provided', async () => {
    const result = await tool.handler({
      topic: 'Team sync',
      startDateTime: '2026-04-10T10:00:00',
      attendees: ['alice@edlight.org', 'bob@edlight.org'],
    }, ctx);

    expect(result.success).toBe(true);
    expect(mockCreateZoomMeeting).toHaveBeenCalledWith(zoomCtx, expect.objectContaining({
      attendees: ['alice@edlight.org', 'bob@edlight.org'],
    }));
    const data = result.data as Record<string, unknown>;
    expect((data.message as string)).toContain('alice@edlight.org');
  });

  it('logs an audit event on success', async () => {
    await tool.handler({ topic: 'Audit test', startDateTime: '2026-04-10T10:00:00' }, ctx);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      action: 'data_access',
      resource: 'createZoomMeeting',
      success: true,
    }));
  });
});
