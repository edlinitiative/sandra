/**
 * Tests for sendWhatsAppGroupInvite tool.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSendInviteLinkToUser = vi.fn();
const mockGetGroupInviteLink = vi.fn();
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/channels/whatsapp-groups-api', () => ({
  sendInviteLinkToUser: (...a: unknown[]) => mockSendInviteLinkToUser(...a),
  getGroupInviteLink: (...a: unknown[]) => mockGetGroupInviteLink(...a),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

// ─── Import tool ──────────────────────────────────────────────────────────────

import '@/lib/tools/send-whatsapp-group-invite';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ToolContext = { sessionId: 'sess-1', userId: 'user-1', scopes: ['whatsapp:groups'] };
const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mockSendInviteLinkToUser.mockResolvedValue(undefined);
  mockGetGroupInviteLink.mockResolvedValue('https://chat.whatsapp.com/abc123');
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sendWhatsAppGroupInvite', () => {
  const tool = toolRegistry.get('sendWhatsAppGroupInvite')!;

  it('is registered with whatsapp:groups scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('whatsapp:groups');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({
      groupId: 'grp-1',
      groupSubject: 'Test',
      recipients: [{ phoneNumber: '+50912345678' }],
    }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('signed in');
  });

  it('sends invites to all recipients', async () => {
    const result = await tool.handler({
      groupId: 'grp-1',
      groupSubject: 'ESLP 2026',
      recipients: [
        { phoneNumber: '+50912345678', name: 'Alice' },
        { phoneNumber: '+50987654321', name: 'Bob' },
      ],
      personalNote: 'Welcome!',
    }, ctx);

    expect(result.success).toBe(true);
    expect(mockSendInviteLinkToUser).toHaveBeenCalledTimes(2);
    const data = result.data as Record<string, unknown>;
    expect(data.sent).toBe(2);
    expect(data.failed).toBe(0);
    expect((data.message as string)).toContain('ESLP 2026');
  });

  it('fetches invite link automatically when not provided', async () => {
    await tool.handler({
      groupId: 'grp-1',
      groupSubject: 'Test',
      recipients: [{ phoneNumber: '+50912345678' }],
    }, ctx);

    expect(mockGetGroupInviteLink).toHaveBeenCalledWith('grp-1');
    expect(mockSendInviteLinkToUser).toHaveBeenCalledWith(
      '+50912345678',
      'https://chat.whatsapp.com/abc123',
      'Test',
      undefined, // no name + no personalNote → note is undefined
    );
  });

  it('uses provided invite link instead of fetching', async () => {
    await tool.handler({
      groupId: 'grp-1',
      groupSubject: 'Test',
      recipients: [{ phoneNumber: '+50912345678' }],
      inviteLink: 'https://chat.whatsapp.com/custom',
    }, ctx);

    expect(mockGetGroupInviteLink).not.toHaveBeenCalled();
    expect(mockSendInviteLinkToUser).toHaveBeenCalledWith(
      '+50912345678',
      'https://chat.whatsapp.com/custom',
      'Test',
      undefined, // no name + no personalNote → note is undefined
    );
  });

  it('reports partial failures per recipient', async () => {
    mockSendInviteLinkToUser
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Invalid number'));

    const result = await tool.handler({
      groupId: 'grp-1',
      groupSubject: 'Test',
      recipients: [
        { phoneNumber: '+50912345678', name: 'Alice' },
        { phoneNumber: 'bad-number', name: 'Bob' },
      ],
    }, ctx);

    expect(result.success).toBe(true); // at least one succeeded
    const data = result.data as Record<string, unknown>;
    expect(data.sent).toBe(1);
    expect(data.failed).toBe(1);
    const results = data.results as Array<{ phone: string; success: boolean; error?: string }>;
    expect(results[1].success).toBe(false);
    expect(results[1].error).toContain('Invalid number');
  });

  it('returns failure when all sends fail', async () => {
    mockSendInviteLinkToUser.mockRejectedValue(new Error('API down'));
    const result = await tool.handler({
      groupId: 'grp-1',
      groupSubject: 'Test',
      recipients: [{ phoneNumber: '+50912345678' }],
    }, ctx);

    expect(result.success).toBe(false);
    const data = result.data as Record<string, unknown>;
    expect(data.sent).toBe(0);
    expect(data.failed).toBe(1);
  });

  it('logs audit event', async () => {
    await tool.handler({
      groupId: 'grp-1',
      groupSubject: 'Audit',
      recipients: [{ phoneNumber: '+50912345678' }],
    }, ctx);

    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      resource: 'sendWhatsAppGroupInvite',
    }));
  });
});
