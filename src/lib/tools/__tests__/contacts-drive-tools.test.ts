/**
 * Tests for listContacts and searchDrive tools.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveGoogleContext = vi.fn();
const mockResolveTenantForUser = vi.fn();
const mockListUsers = vi.fn();
const mockGetUserByEmail = vi.fn();
const mockSearchFiles = vi.fn();
const mockGetFileContent = vi.fn();
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext: (...a: unknown[]) => mockResolveGoogleContext(...a),
  resolveTenantForUser: (...a: unknown[]) => mockResolveTenantForUser(...a),
}));

vi.mock('@/lib/google/directory', () => ({
  listUsers: (...a: unknown[]) => mockListUsers(...a),
  getUserByEmail: (...a: unknown[]) => mockGetUserByEmail(...a),
}));

vi.mock('@/lib/google/drive', () => ({
  searchFiles: (...a: unknown[]) => mockSearchFiles(...a),
  getFileContent: (...a: unknown[]) => mockGetFileContent(...a),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

// ─── Import tools ──────────────────────────────────────────────────────────────

import '@/lib/tools/list-contacts';
import '@/lib/tools/search-drive';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ToolContext = { sessionId: 'sess-1', userId: 'user-1', scopes: ['contacts:read', 'drive:read'] };
const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

const googleCtx = { impersonateEmail: 'rony@edlight.org', config: { driveImpersonateEmail: null, driveFolderIds: [] } };

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockResolveGoogleContext.mockResolvedValue(googleCtx);
});

// ─── listContacts ─────────────────────────────────────────────────────────────

describe('listContacts', () => {
  const tool = toolRegistry.get('listContacts')!;

  it('is registered with contacts:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('contacts:read');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('returns error when no tenant linked', async () => {
    mockResolveTenantForUser.mockResolvedValue(null);
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('organization');
  });

  it('lists directory users', async () => {
    mockListUsers.mockResolvedValue({
      users: [
        { name: 'Rony Jean', email: 'rony@edlight.org', department: 'Engineering', title: 'CTO', phone: '', suspended: false },
        { name: 'Ted Smith', email: 'ted@edlight.org', department: 'Education', title: 'Director', phone: '', suspended: false },
      ],
    });

    const result = await tool.handler({ query: 'engineering' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const contacts = data.contacts as Array<{ name: string; email: string }>;
    expect(contacts.length).toBe(2);
    expect(contacts[0].name).toBe('Rony Jean');
    expect(contacts[0].email).toBe('rony@edlight.org');
  });

  it('filters out suspended and non-personal accounts', async () => {
    mockListUsers.mockResolvedValue({
      users: [
        { name: 'Real User', email: 'real@edlight.org', department: '', title: '', phone: '', suspended: false },
        { name: 'Suspended', email: 'old@edlight.org', department: '', title: '', phone: '', suspended: true },
        { name: 'Info Account', email: 'info@edlight.org', department: '', title: '', phone: '', suspended: false },
        { name: 'Support', email: 'support@edlight.org', department: '', title: '', phone: '', suspended: false },
      ],
    });

    const result = await tool.handler({}, ctx);
    const data = result.data as Record<string, unknown>;
    const contacts = data.contacts as Array<{ email: string }>;
    expect(contacts.length).toBe(1);
    expect(contacts[0].email).toBe('real@edlight.org');
  });

  it('returns empty message when no contacts found', async () => {
    mockListUsers.mockResolvedValue({ users: [] });
    const result = await tool.handler({}, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect((data.message as string)).toContain('No contacts found');
  });

  it('looks up a single user by email', async () => {
    mockGetUserByEmail.mockResolvedValue({
      name: 'Rony Jean', email: 'rony@edlight.org', department: 'Engineering', title: 'CTO', phone: '+50912345678', suspended: false,
    });

    const result = await tool.handler({ email: 'rony@edlight.org' }, ctx);
    expect(result.success).toBe(true);
    expect(mockGetUserByEmail).toHaveBeenCalledWith(googleCtx, 'rony@edlight.org');
    const data = result.data as Record<string, unknown>;
    const contacts = data.contacts as Array<{ name: string }>;
    expect(contacts[0].name).toBe('Rony Jean');
  });

  it('returns empty when single email lookup finds nothing', async () => {
    mockGetUserByEmail.mockResolvedValue(null);
    const result = await tool.handler({ email: 'unknown@edlight.org' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect((data.contacts as unknown[]).length).toBe(0);
  });
});

// ─── searchDrive ──────────────────────────────────────────────────────────────

describe('searchDrive', () => {
  const tool = toolRegistry.get('searchDrive')!;

  it('is registered with drive:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('drive:read');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ query: 'test' }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('returns error when no tenant linked', async () => {
    mockResolveTenantForUser.mockResolvedValue(null);
    const result = await tool.handler({ query: 'test' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('organization');
  });

  it('returns matching files', async () => {
    mockSearchFiles.mockResolvedValue({
      files: [
        { name: 'ESLP Handbook 2026.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/1', modifiedTime: '2026-01-01T00:00:00Z', id: 'file-1' },
        { name: 'ESLP Budget.xlsx', mimeType: 'application/vnd.ms-excel', webViewLink: 'https://drive.google.com/file/2', modifiedTime: '2026-02-01T00:00:00Z', id: 'file-2' },
      ],
    });

    const result = await tool.handler({ query: 'ESLP' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect((data.files as unknown[]).length).toBe(2);
    expect((data.message as string)).toContain('2 file');
  });

  it('returns empty message when no files found', async () => {
    mockSearchFiles.mockResolvedValue({ files: [] });
    const result = await tool.handler({ query: 'nonexistent' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect((data.message as string)).toContain('No files found');
  });

  it('fetches file content when includeContent=true', async () => {
    mockSearchFiles.mockResolvedValue({
      files: [
        { name: 'README.txt', mimeType: 'text/plain', webViewLink: 'https://drive.google.com/file/1', modifiedTime: '2026-01-01T00:00:00Z', id: 'file-1' },
      ],
    });
    mockGetFileContent.mockResolvedValue({ text: 'This is the README content.' });

    const result = await tool.handler({ query: 'README', includeContent: true }, ctx);
    expect(mockGetFileContent).toHaveBeenCalled();
    const data = result.data as Record<string, unknown>;
    const files = data.files as Array<{ content?: string }>;
    expect(files[0].content).toBe('This is the README content.');
  });

  it('logs audit event', async () => {
    mockSearchFiles.mockResolvedValue({ files: [] });
    await tool.handler({ query: 'audit test' }, ctx);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', resource: 'searchDrive', success: true,
    }));
  });
});
