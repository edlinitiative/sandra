/**
 * Tests for createWhatsAppGroup tool.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCreateGroup = vi.fn();
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/channels/whatsapp-groups-api', () => ({
  createGroup: (...a: unknown[]) => mockCreateGroup(...a),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

// ─── Import tool ──────────────────────────────────────────────────────────────

import '@/lib/tools/create-whatsapp-group';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ToolContext = { sessionId: 'sess-1', userId: 'user-1', scopes: ['whatsapp:groups'] };
const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

const groupResult = {
  groupId: 'grp-123',
  subject: 'ESLP 2026 Cohort',
  description: 'Welcome to ESLP!',
  inviteLink: 'https://chat.whatsapp.com/abc123',
  joinApprovalMode: 'auto_approve',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateGroup.mockResolvedValue(groupResult);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createWhatsAppGroup', () => {
  const tool = toolRegistry.get('createWhatsAppGroup')!;

  it('is registered with whatsapp:groups scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('whatsapp:groups');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ subject: 'Test' }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('signed in');
  });

  it('creates a group and returns invite link', async () => {
    const result = await tool.handler({
      subject: 'ESLP 2026 Cohort',
      description: 'Welcome to ESLP!',
    }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.groupId).toBe('grp-123');
    expect(data.inviteLink).toBe('https://chat.whatsapp.com/abc123');
    expect(data.subject).toBe('ESLP 2026 Cohort');
    expect((data.message as string)).toContain('ESLP 2026 Cohort');
  });

  it('passes joinApprovalMode to the API', async () => {
    await tool.handler({
      subject: 'Private Group',
      joinApprovalMode: 'approval_required',
    }, ctx);

    expect(mockCreateGroup).toHaveBeenCalledWith(expect.objectContaining({
      joinApprovalMode: 'approval_required',
    }));
  });

  it('shows approval note when approval_required', async () => {
    mockCreateGroup.mockResolvedValue({ ...groupResult, joinApprovalMode: 'approval_required' });
    const result = await tool.handler({
      subject: 'Private Group',
      joinApprovalMode: 'approval_required',
    }, ctx);

    const data = result.data as Record<string, unknown>;
    expect((data.message as string)).toContain('approval');
  });

  it('returns friendly error when WhatsApp not configured', async () => {
    mockCreateGroup.mockRejectedValue(new Error('WHATSAPP_PHONE_NUMBER_ID not configured'));
    const result = await tool.handler({ subject: 'Test' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('returns friendly error on expired token', async () => {
    mockCreateGroup.mockRejectedValue(new Error('Error 190: invalid token'));
    const result = await tool.handler({ subject: 'Test' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('token');
  });

  it('logs audit event on success', async () => {
    await tool.handler({ subject: 'Audit test' }, ctx);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      resource: 'createWhatsAppGroup',
      success: true,
    }));
  });
});
