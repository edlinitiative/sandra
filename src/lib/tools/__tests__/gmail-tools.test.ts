/**
 * Tests for draftGmail and sendGmail tools.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveGoogleContext = vi.fn();
const mockResolveTenantForUser = vi.fn();
const mockCreateDraft = vi.fn();
const mockSendEmail = vi.fn();
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);
const mockFindUnique = vi.fn();
const mockRateLimiterConsume = vi.fn().mockReturnValue(true);

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext: (...a: unknown[]) => mockResolveGoogleContext(...a),
  resolveTenantForUser: (...a: unknown[]) => mockResolveTenantForUser(...a),
  resolveTenantForContext: (...a: unknown[]) => mockResolveTenantForUser(...a),
}));

vi.mock('@/lib/google/gmail', () => ({
  createDraft: (...a: unknown[]) => mockCreateDraft(...a),
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
}));

vi.mock('@/lib/actions/rate-limiter', () => ({
  actionRateLimiter: {
    consume: (...a: unknown[]) => mockRateLimiterConsume(...a),
  },
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: (...a: unknown[]) => mockFindUnique(...a) },
  },
}));

// ─── Import tools ──────────────────────────────────────────────────────────────

import '@/lib/tools/draft-gmail';
import '@/lib/tools/send-gmail';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ToolContext = { sessionId: 'sess-1', userId: 'user-1', scopes: ['gmail:draft', 'gmail:send'] };
const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

const googleCtx = { impersonateEmail: 'rony@edlight.org', config: {} };

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockFindUnique.mockResolvedValue({ email: 'rony@edlight.org', name: 'Rony' });
  mockResolveGoogleContext.mockResolvedValue(googleCtx);
  mockCreateDraft.mockResolvedValue({ draftId: 'draft-123' });
  mockSendEmail.mockResolvedValue({ messageId: 'msg-456' });
  mockRateLimiterConsume.mockReturnValue(true);
});

// ─── draftGmail ───────────────────────────────────────────────────────────────

describe('draftGmail', () => {
  const tool = toolRegistry.get('draftGmail')!;

  it('is registered with gmail:draft scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('gmail:draft');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ to: ['a@b.com'], subject: 'Hi there', body: 'Hello world.' }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('returns error when no tenant linked', async () => {
    mockResolveTenantForUser.mockResolvedValue(null);
    const result = await tool.handler({ to: ['a@b.com'], subject: 'Hi there', body: 'Hello world.' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('organization');
  });

  it('returns error when no email found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await tool.handler({ to: ['a@b.com'], subject: 'Hi there', body: 'Hello world.' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('creates a draft and returns draftId', async () => {
    const result = await tool.handler({
      to: ['alice@edlight.org'],
      subject: 'Meeting follow-up',
      body: 'Hi Alice, just following up on our meeting yesterday.',
      cc: ['bob@edlight.org'],
    }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.draftId).toBe('draft-123');
    expect(data.from).toBe('rony@edlight.org');
    expect(data.to).toEqual(['alice@edlight.org']);
    expect(data.subject).toBe('Meeting follow-up');
    expect((data.message as string)).toContain('Drafts');
    expect(mockCreateDraft).toHaveBeenCalledWith(googleCtx, expect.objectContaining({
      from: 'rony@edlight.org',
      to: ['alice@edlight.org'],
      cc: ['bob@edlight.org'],
      subject: 'Meeting follow-up',
    }));
  });

  it('logs audit event on success', async () => {
    await tool.handler({ to: ['a@b.com'], subject: 'Audit test', body: 'Testing audit logging.' }, ctx);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', resource: 'draftGmail', success: true,
    }));
  });
});

// ─── sendGmail ────────────────────────────────────────────────────────────────

describe('sendGmail', () => {
  const tool = toolRegistry.get('sendGmail')!;

  it('is registered with gmail:send scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('gmail:send');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ to: ['a@b.com'], subject: 'Hi there', body: 'Hello world.' }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('returns error when no tenant linked', async () => {
    mockResolveTenantForUser.mockResolvedValue(null);
    const result = await tool.handler({ to: ['a@b.com'], subject: 'Hi there', body: 'Hello world.' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('organization');
  });

  it('enforces rate limit', async () => {
    mockRateLimiterConsume.mockReturnValue(false);
    const result = await tool.handler({ to: ['a@b.com'], subject: 'Hi there', body: 'Hello world.' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('rate limit');
  });

  it('sends email and returns messageId', async () => {
    const result = await tool.handler({
      to: ['alice@edlight.org'],
      subject: 'Action required',
      body: 'Please review the document and respond by Friday.',
    }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.messageId).toBe('msg-456');
    expect(data.from).toBe('rony@edlight.org');
    expect(data.to).toEqual(['alice@edlight.org']);
    expect((data.message as string)).toContain('alice@edlight.org');
    expect(mockSendEmail).toHaveBeenCalledWith(googleCtx, expect.objectContaining({
      from: 'rony@edlight.org',
      to: ['alice@edlight.org'],
    }));
  });

  it('logs audit event with admin_action on success', async () => {
    await tool.handler({ to: ['a@b.com'], subject: 'Audit test', body: 'Testing audit logging.' }, ctx);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      action: 'admin_action',
      resource: 'sendGmail',
      success: true,
    }));
  });
});
