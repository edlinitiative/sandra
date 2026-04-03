/**
 * Tests for Phase 14 Google Workspace tools:
 *   listCalendarEvents, updateCalendarEvent, deleteCalendarEvent,
 *   readGmail, replyGmail, createGoogleDoc, createSpreadsheet,
 *   readDriveFile, shareDriveFile
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveGoogleContext = vi.fn();
const mockResolveTenantForUser = vi.fn().mockResolvedValue('tenant-1');
const mockListCalendarEvents   = vi.fn();
const mockUpdateCalendarEvent  = vi.fn();
const mockDeleteCalendarEvent  = vi.fn();
const mockListMessages         = vi.fn();
const mockGetMessage           = vi.fn();
const mockReplyToMessage       = vi.fn();
const mockGetFileById          = vi.fn();
const mockCreateGoogleDoc      = vi.fn();
const mockCreateGoogleSheet    = vi.fn();
const mockShareFile            = vi.fn();
const mockLogAuditEvent        = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext:  (...a: unknown[]) => mockResolveGoogleContext(...a),
  resolveTenantForUser:  (...a: unknown[]) => mockResolveTenantForUser(...a),
}));

vi.mock('@/lib/google/calendar', () => ({
  listCalendarEvents:  (...a: unknown[]) => mockListCalendarEvents(...a),
  updateCalendarEvent: (...a: unknown[]) => mockUpdateCalendarEvent(...a),
  deleteCalendarEvent: (...a: unknown[]) => mockDeleteCalendarEvent(...a),
  createCalendarEvent: vi.fn(),
}));

vi.mock('@/lib/google/gmail', () => ({
  listMessages:    (...a: unknown[]) => mockListMessages(...a),
  getMessage:      (...a: unknown[]) => mockGetMessage(...a),
  replyToMessage:  (...a: unknown[]) => mockReplyToMessage(...a),
  sendEmail:       vi.fn(),
  createDraft:     vi.fn(),
}));

vi.mock('@/lib/google/drive', () => ({
  getFileById:       (...a: unknown[]) => mockGetFileById(...a),
  createGoogleDoc:   (...a: unknown[]) => mockCreateGoogleDoc(...a),
  createGoogleSheet: (...a: unknown[]) => mockCreateGoogleSheet(...a),
  shareFile:         (...a: unknown[]) => mockShareFile(...a),
  getFilesContent:   vi.fn(),
  searchDriveFiles:  vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/actions/rate-limiter', () => ({
  actionRateLimiter: {
    consume:   vi.fn().mockReturnValue(true),
    isAllowed: vi.fn().mockReturnValue(true),
    remaining: vi.fn().mockReturnValue(10),
    reset:     vi.fn(),
    resetAll:  vi.fn(),
  },
}));

// ─── Import tools ─────────────────────────────────────────────────────────────

import '@/lib/tools/list-calendar-events';
import '@/lib/tools/update-calendar-event';
import '@/lib/tools/delete-calendar-event';
import '@/lib/tools/read-gmail';
import '@/lib/tools/reply-gmail';
import '@/lib/tools/create-google-doc';
import '@/lib/tools/create-spreadsheet';
import '@/lib/tools/read-drive-file';
import '@/lib/tools/share-drive-file';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Contexts ────────────────────────────────────────────────────────────────

const ctx: ToolContext = {
  sessionId: 'sess-1',
  userId:    'user-1',
  scopes:    ['calendar:read', 'calendar:write', 'gmail:read', 'gmail:send', 'drive:read', 'drive:write'],
};

const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

const fakeGoogleCtx = { tenantId: 'tenant-1', credentials: {}, config: { domain: 'test.org', adminEmail: 'admin@test.org' } };

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockResolveGoogleContext.mockResolvedValue(fakeGoogleCtx);
});

// ─── listCalendarEvents ───────────────────────────────────────────────────────

describe('listCalendarEvents', () => {
  const tool = toolRegistry.get('listCalendarEvents')!;

  it('is registered with calendar:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('calendar:read');
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns events list on success', async () => {
    const events = [
      { id: 'evt-1', summary: 'Team Standup', start: { dateTime: '2026-04-05T09:00:00Z' }, end: { dateTime: '2026-04-05T09:30:00Z' } },
    ];
    mockListCalendarEvents.mockResolvedValueOnce({ events, nextPageToken: undefined });

    const result = await tool.handler({ maxResults: 5 }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { events: unknown[] };
    expect(data.events).toHaveLength(1);
    expect(data.events[0]).toMatchObject({ id: 'evt-1' });
  });

  it('propagates google context errors', async () => {
    mockResolveTenantForUser.mockResolvedValueOnce(null);
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ─── updateCalendarEvent ──────────────────────────────────────────────────────

describe('updateCalendarEvent', () => {
  const tool = toolRegistry.get('updateCalendarEvent')!;

  it('is registered with calendar:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('calendar:write');
  });

  it('rejects missing eventId', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('calls updateCalendarEvent and returns event', async () => {
    const updated = { id: 'evt-1', summary: 'Updated Meeting', status: 'confirmed' };
    mockUpdateCalendarEvent.mockResolvedValueOnce(updated);

    const result = await tool.handler({ eventId: 'evt-1', summary: 'Updated Meeting' }, ctx);
    expect(result.success).toBe(true);
    expect((result.data as { event: unknown }).event).toMatchObject({ id: 'evt-1' });
    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(fakeGoogleCtx, 'evt-1', { summary: 'Updated Meeting' });
  });
});

// ─── deleteCalendarEvent ──────────────────────────────────────────────────────

describe('deleteCalendarEvent', () => {
  const tool = toolRegistry.get('deleteCalendarEvent')!;

  it('is registered with calendar:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('calendar:write');
  });

  it('rejects missing eventId', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('deletes event and returns confirmation', async () => {
    mockDeleteCalendarEvent.mockResolvedValueOnce(undefined);

    const result = await tool.handler({ eventId: 'evt-1' }, ctx);
    expect(result.success).toBe(true);
    expect((result.data as { confirmation: string }).confirmation).toContain('evt-1');
  });
});

// ─── readGmail ────────────────────────────────────────────────────────────────

describe('readGmail', () => {
  const tool = toolRegistry.get('readGmail')!;

  it('is registered with gmail:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('gmail:read');
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('lists messages on success', async () => {
    const messages = [
      { id: 'msg-1', subject: 'Test Email', from: 'alice@test.org', snippet: 'Hello', body: 'Hello world', date: '2026-04-01' },
    ];
    mockListMessages.mockResolvedValueOnce(messages);

    const result = await tool.handler({ maxResults: 5 }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { messages: unknown[]; count: number };
    expect(data.count).toBe(1);
    expect(data.messages[0]).toMatchObject({ id: 'msg-1' });
  });

  it('fetches single message when messageId provided', async () => {
    const msg = { id: 'msg-2', subject: 'Single', from: 'bob@test.org', snippet: 'Hi', body: 'Hi there', date: '2026-04-02' };
    mockGetMessage.mockResolvedValueOnce(msg);

    const result = await tool.handler({ messageId: 'msg-2' }, ctx);
    expect(result.success).toBe(true);
    expect(mockGetMessage).toHaveBeenCalledWith(fakeGoogleCtx, 'msg-2');
  });
});

// ─── replyGmail ───────────────────────────────────────────────────────────────

describe('replyGmail', () => {
  const tool = toolRegistry.get('replyGmail')!;

  it('is registered with gmail:send scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('gmail:send');
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler(
      { messageId: 'msg-1', body: 'Got it!' },
      anonCtx,
    );
    expect(result.success).toBe(false);
  });

  it('sends reply and returns message id', async () => {
    mockReplyToMessage.mockResolvedValueOnce({ id: 'msg-reply-1', threadId: 'thread-1', labelIds: ['SENT'] });

    const result = await tool.handler(
      { messageId: 'msg-1', body: 'Thanks!' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect((result.data as { messageId: string }).messageId).toBe('msg-reply-1');
  });
});

// ─── createGoogleDoc ──────────────────────────────────────────────────────────

describe('createGoogleDoc', () => {
  const tool = toolRegistry.get('createGoogleDoc')!;

  it('is registered with drive:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('drive:write');
  });

  it('rejects missing title', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('creates document and returns file info', async () => {
    mockCreateGoogleDoc.mockResolvedValueOnce({
      id: 'doc-1', name: 'Meeting Notes', mimeType: 'application/vnd.google-apps.document', webViewLink: 'https://docs.google.com/doc-1',
    });

    const result = await tool.handler({ title: 'Meeting Notes', content: 'Agenda...' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { fileId: string; url: string };
    expect(data.fileId).toBe('doc-1');
    expect(data.url).toContain('docs.google.com');
  });
});

// ─── createSpreadsheet ────────────────────────────────────────────────────────

describe('createSpreadsheet', () => {
  const tool = toolRegistry.get('createSpreadsheet')!;

  it('is registered with drive:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('drive:write');
  });

  it('creates spreadsheet and returns file info', async () => {
    mockCreateGoogleSheet.mockResolvedValueOnce({
      id: 'sheet-1', name: 'Budget 2026', mimeType: 'application/vnd.google-apps.spreadsheet', webViewLink: 'https://sheets.google.com/sheet-1',
    });

    const result = await tool.handler({ title: 'Budget 2026' }, ctx);
    expect(result.success).toBe(true);
    expect((result.data as { fileId: string }).fileId).toBe('sheet-1');
  });
});

// ─── readDriveFile ────────────────────────────────────────────────────────────

describe('readDriveFile', () => {
  const tool = toolRegistry.get('readDriveFile')!;

  it('is registered with drive:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('drive:read');
  });

  it('returns file metadata and content', async () => {
    mockGetFileById.mockResolvedValueOnce({
      id: 'file-1', name: 'Report.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file-1', size: '102400',
    });

    const result = await tool.handler({ fileId: 'file-1' }, ctx);
    expect(result.success).toBe(true);
    expect((result.data as { file: { id: string } }).file.id).toBe('file-1');
  });

  it('returns error when file not found', async () => {
    mockGetFileById.mockResolvedValueOnce(null);
    const result = await tool.handler({ fileId: 'missing-file' }, ctx);
    expect(result.success).toBe(false);
  });
});

// ─── shareDriveFile ───────────────────────────────────────────────────────────

describe('shareDriveFile', () => {
  const tool = toolRegistry.get('shareDriveFile')!;

  it('is registered with drive:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('drive:write');
  });

  it('rejects invalid email', async () => {
    await expect(
      tool.handler({ fileId: 'file-1', email: 'not-an-email', role: 'reader' }, ctx),
    ).rejects.toThrow();
  });

  it('shares file and returns confirmation', async () => {
    mockShareFile.mockResolvedValueOnce({ permissionId: 'perm-1', email: 'bob@test.org', role: 'reader' });

    const result = await tool.handler(
      { fileId: 'file-1', email: 'bob@test.org', role: 'reader' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect((result.data as { confirmation: string }).confirmation).toContain('bob@test.org');
  });
});
