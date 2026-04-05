/**
 * Tests for Phase 14 Google Workspace tools:
 *   listCalendarEvents, updateCalendarEvent, deleteCalendarEvent,
 *   readGmail, replyGmail,
 *   createGoogleDoc, createSpreadsheet, readDriveFile, shareDriveFile
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveTenantForUser  = vi.fn().mockResolvedValue('tenant-1');
const mockResolveGoogleContext  = vi.fn().mockResolvedValue({ config: { driveImpersonateEmail: null }, auth: {} });
const mockLogAuditEvent         = vi.fn().mockResolvedValue(undefined);
const mockRateLimiterConsume    = vi.fn().mockReturnValue(true);

// Calendar
const mockListCalendarEvents    = vi.fn();
const mockUpdateCalendarEvent   = vi.fn();
const mockDeleteCalendarEvent   = vi.fn();

// Gmail
const mockListMessages          = vi.fn();
const mockGetMessage            = vi.fn();
const mockReplyToMessage        = vi.fn();

// Drive
const mockCreateGoogleDoc       = vi.fn();
const mockCreateGoogleSheet     = vi.fn();
const mockGetFileById           = vi.fn();
const mockGetFileContent        = vi.fn();
const mockShareFile             = vi.fn();

// DB
const mockUserFindUnique        = vi.fn();

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext:  (...a: unknown[]) => mockResolveGoogleContext(...a),
  resolveTenantForUser:  (...a: unknown[]) => mockResolveTenantForUser(...a),
  resolveTenantForContext: (...a: unknown[]) => mockResolveTenantForUser(...a),
}));

vi.mock('@/lib/google/calendar', () => ({
  listCalendarEvents:   (...a: unknown[]) => mockListCalendarEvents(...a),
  updateCalendarEvent:  (...a: unknown[]) => mockUpdateCalendarEvent(...a),
  deleteCalendarEvent:  (...a: unknown[]) => mockDeleteCalendarEvent(...a),
  createCalendarEvent:  vi.fn(),
}));

vi.mock('@/lib/google/gmail', () => ({
  listMessages:   (...a: unknown[]) => mockListMessages(...a),
  getMessage:     (...a: unknown[]) => mockGetMessage(...a),
  replyToMessage: (...a: unknown[]) => mockReplyToMessage(...a),
  sendEmail:      vi.fn(),
  createDraft:    vi.fn(),
}));

vi.mock('@/lib/google/drive', () => ({
  createGoogleDoc:   (...a: unknown[]) => mockCreateGoogleDoc(...a),
  createGoogleSheet: (...a: unknown[]) => mockCreateGoogleSheet(...a),
  getFileById:       (...a: unknown[]) => mockGetFileById(...a),
  getFileContent:    (...a: unknown[]) => mockGetFileContent(...a),
  shareFile:         (...a: unknown[]) => mockShareFile(...a),
  listFolder:        vi.fn(),
  searchFiles:       vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/actions/rate-limiter', () => ({
  actionRateLimiter: {
    consume: (...a: unknown[]) => mockRateLimiterConsume(...a),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
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

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockResolveGoogleContext.mockResolvedValue({ config: { driveImpersonateEmail: null }, auth: {} });
  mockRateLimiterConsume.mockReturnValue(true);
  // Most tools need the user's email
  mockUserFindUnique.mockResolvedValue({ email: 'user@test.org' });
});

// ─── listCalendarEvents ───────────────────────────────────────────────────────

describe('listCalendarEvents', () => {
  const tool = toolRegistry.get('listCalendarEvents')!;

  it('is registered with calendar:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('calendar:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns events from Google Calendar', async () => {
    mockListCalendarEvents.mockResolvedValueOnce({
      events: [
        { id: 'evt-1', summary: 'Team Standup', start: { dateTime: '2026-04-05T09:00:00Z' }, end: { dateTime: '2026-04-05T09:30:00Z' } },
      ],
    });
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { events: unknown[] };
    expect(data.events).toHaveLength(1);
  });

  it('returns message when no events found', async () => {
    mockListCalendarEvents.mockResolvedValueOnce({ events: [] });
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { events: unknown[]; message: string };
    expect(data.events).toHaveLength(0);
  });
});

// ─── updateCalendarEvent ──────────────────────────────────────────────────────

describe('updateCalendarEvent', () => {
  const tool = toolRegistry.get('updateCalendarEvent')!;

  it('is registered with calendar:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('calendar:write');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({ eventId: 'evt-1' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('rejects missing eventId', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('updates an event and returns confirmation', async () => {
    mockUpdateCalendarEvent.mockResolvedValueOnce({
      id: 'evt-1', summary: 'Updated Meeting', htmlLink: 'https://calendar.google.com/event?eid=evt-1',
    });
    const result = await tool.handler({ eventId: 'evt-1', summary: 'Updated Meeting' }, ctx);
    expect(result.success).toBe(true);
    // Tool returns { confirmation, event } — not { eventId }
    const data = result.data as { confirmation: string; event: { id: string } };
    expect(data.event.id).toBe('evt-1');
    expect(data.confirmation).toContain('Updated Meeting');
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

  it('deletes an event and returns confirmation', async () => {
    mockDeleteCalendarEvent.mockResolvedValueOnce(undefined);
    const result = await tool.handler({ eventId: 'evt-1' }, ctx);
    expect(result.success).toBe(true);
    expect(mockDeleteCalendarEvent).toHaveBeenCalled();
  });
});

// ─── readGmail ────────────────────────────────────────────────────────────────

describe('readGmail', () => {
  const tool = toolRegistry.get('readGmail')!;

  it('is registered with gmail:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('gmail:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns messages list', async () => {
    mockListMessages.mockResolvedValueOnce([
      { id: 'msg-1', threadId: 'thread-1', snippet: 'Hello', from: 'bob@co.com', subject: 'Hi', date: '2026-04-01' },
    ]);
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { messages: unknown[] };
    expect(data.messages).toHaveLength(1);
  });

  it('fetches a single message by ID', async () => {
    mockGetMessage.mockResolvedValueOnce({
      id: 'msg-1', threadId: 'thread-1', snippet: 'Full content', from: 'bob@co.com', subject: 'Hi', date: '2026-04-01', body: 'Hello there',
    });
    const result = await tool.handler({ messageId: 'msg-1' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { message: { id: string } };
    expect(data.message.id).toBe('msg-1');
  });
});

// ─── replyGmail ───────────────────────────────────────────────────────────────

describe('replyGmail', () => {
  const tool = toolRegistry.get('replyGmail')!;

  it('is registered with gmail:send scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('gmail:send');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler(
      { threadId: 't-1', inReplyToMessageId: 'm-1', to: ['a@b.com'], subject: 'Re: Hi', body: 'Yes' },
      anonCtx,
    );
    expect(result.success).toBe(false);
  });

  it('sends a reply and returns confirmation', async () => {
    mockReplyToMessage.mockResolvedValueOnce({ messageId: 'new-msg-1', threadId: 't-1' });
    const result = await tool.handler(
      { threadId: 't-1', inReplyToMessageId: 'm-1', to: ['bob@co.com'], subject: 'Re: Hi', body: 'Yes I can!' },
      ctx,
    );
    expect(result.success).toBe(true);
    const data = result.data as { messageId: string };
    expect(data.messageId).toBe('new-msg-1');
  });
});

// ─── createGoogleDoc ──────────────────────────────────────────────────────────

describe('createGoogleDoc', () => {
  const tool = toolRegistry.get('createGoogleDoc')!;

  it('is registered with drive:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('drive:write');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ title: 'My Doc' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('rejects missing title', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('creates a doc and returns file metadata', async () => {
    mockCreateGoogleDoc.mockResolvedValueOnce({
      id: 'file-1', name: 'My Doc', webViewLink: 'https://docs.google.com/1', mimeType: 'application/vnd.google-apps.document',
    });
    const result = await tool.handler({ title: 'My Doc' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { file: { id: string; name: string } };
    expect(data.file.id).toBe('file-1');
    expect(data.file.name).toBe('My Doc');
  });
});

// ─── createSpreadsheet ────────────────────────────────────────────────────────

describe('createSpreadsheet', () => {
  const tool = toolRegistry.get('createSpreadsheet')!;

  it('is registered with drive:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('drive:write');
  });

  it('rejects missing title', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('creates a spreadsheet and returns file metadata', async () => {
    mockCreateGoogleSheet.mockResolvedValueOnce({
      id: 'sheet-1', name: 'My Sheet', webViewLink: 'https://sheets.google.com/1', mimeType: 'application/vnd.google-apps.spreadsheet',
    });
    const result = await tool.handler({ title: 'My Sheet', headers: ['Name', 'Email'] }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { file: { id: string } };
    expect(data.file.id).toBe('sheet-1');
  });
});

// ─── readDriveFile ────────────────────────────────────────────────────────────

describe('readDriveFile', () => {
  const tool = toolRegistry.get('readDriveFile')!;

  it('is registered with drive:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('drive:read');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ fileId: 'f-1' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('rejects missing fileId', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('returns file content', async () => {
    mockGetFileById.mockResolvedValueOnce({
      id: 'f-1', name: 'Report.docx', mimeType: 'application/vnd.google-apps.document', webViewLink: 'https://docs.google.com/f-1',
    });
    // getFileContent returns { text, extractionMethod } not a plain string
    mockGetFileContent.mockResolvedValueOnce({ text: 'This is the document content.', extractionMethod: 'plain-text' });
    const result = await tool.handler({ fileId: 'f-1' }, ctx);
    expect(result.success).toBe(true);
    // Tool returns { file: { id, name, ... }, content, extractionMethod, truncated }
    const data = result.data as { file: { name: string }; content: string };
    expect(data.file.name).toBe('Report.docx');
    expect(data.content).toContain('document content');
  });
});

// ─── shareDriveFile ───────────────────────────────────────────────────────────

describe('shareDriveFile', () => {
  const tool = toolRegistry.get('shareDriveFile')!;

  it('is registered with drive:write scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('drive:write');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ fileId: 'f-1', email: 'bob@co.com' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('rejects missing fileId or email', async () => {
    await expect(tool.handler({ fileId: 'f-1' }, ctx)).rejects.toThrow();
    await expect(tool.handler({ email: 'bob@co.com' }, ctx)).rejects.toThrow();
  });

  it('shares the file and returns confirmation', async () => {
    mockGetFileById.mockResolvedValueOnce({
      id: 'f-1', name: 'Report.docx', webViewLink: 'https://docs.google.com/f-1',
    });
    mockShareFile.mockResolvedValueOnce({ id: 'perm-1', role: 'reader', type: 'user' });
    const result = await tool.handler({ fileId: 'f-1', email: 'bob@co.com', role: 'reader' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { confirmation: string; file: { id: string } };
    expect(data.file.id).toBe('f-1');
    expect(data.confirmation).toContain('bob@co.com');
  });
});
