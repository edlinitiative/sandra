/**
 * Tests for getWhatsAppGroups tool (list / info / invite_link actions).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockListGroups = vi.fn();
const mockGetGroupInfo = vi.fn();
const mockGetGroupInviteLink = vi.fn();
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/channels/whatsapp-groups-api', () => ({
  listGroups: (...a: unknown[]) => mockListGroups(...a),
  getGroupInfo: (...a: unknown[]) => mockGetGroupInfo(...a),
  getGroupInviteLink: (...a: unknown[]) => mockGetGroupInviteLink(...a),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

// ─── Import tool ──────────────────────────────────────────────────────────────

import '@/lib/tools/get-whatsapp-groups';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ToolContext = { sessionId: 'sess-1', userId: 'user-1', scopes: ['whatsapp:groups'] };
const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

beforeEach(() => vi.clearAllMocks());

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getWhatsAppGroups', () => {
  const tool = toolRegistry.get('getWhatsAppGroups')!;

  it('is registered with whatsapp:groups scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('whatsapp:groups');
  });

  it('rejects anonymous users', async () => {
    const result = await tool.handler({ action: 'list' }, anonCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('signed in');
  });

  // ─── list ────────────────────────────────────────────────────────

  describe('action=list', () => {
    it('returns groups list', async () => {
      mockListGroups.mockResolvedValue({
        groups: [
          { groupId: 'grp-1', subject: 'ESLP 2026', createdAt: '2026-03-01T00:00:00Z' },
          { groupId: 'grp-2', subject: 'Team A', createdAt: '2026-03-15T00:00:00Z' },
        ],
        nextPageToken: null,
      });

      const result = await tool.handler({ action: 'list' }, ctx);
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect((data.groups as unknown[]).length).toBe(2);
      expect((data.message as string)).toContain('ESLP 2026');
      expect(mockListGroups).toHaveBeenCalledWith(25); // default limit
    });

    it('handles empty group list', async () => {
      mockListGroups.mockResolvedValue({ groups: [], nextPageToken: null });
      const result = await tool.handler({ action: 'list' }, ctx);
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect((data.message as string)).toContain('No active');
    });

    it('passes custom limit', async () => {
      mockListGroups.mockResolvedValue({ groups: [], nextPageToken: null });
      await tool.handler({ action: 'list', limit: 5 }, ctx);
      expect(mockListGroups).toHaveBeenCalledWith(5);
    });
  });

  // ─── info ────────────────────────────────────────────────────────

  describe('action=info', () => {
    it('returns group info', async () => {
      mockGetGroupInfo.mockResolvedValue({
        groupId: 'grp-1',
        subject: 'ESLP 2026',
        description: 'Cohort group',
        totalParticipantCount: 5,
        participants: ['509123', '509456'],
        joinApprovalMode: 'auto_approve',
        suspended: false,
      });

      const result = await tool.handler({ action: 'info', groupId: 'grp-1' }, ctx);
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.subject).toBe('ESLP 2026');
      expect(data.totalParticipantCount).toBe(5);
    });

    it('requires groupId', async () => {
      const result = await tool.handler({ action: 'info' }, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('groupId');
    });
  });

  // ─── invite_link ─────────────────────────────────────────────────

  describe('action=invite_link', () => {
    it('returns invite link', async () => {
      mockGetGroupInviteLink.mockResolvedValue('https://chat.whatsapp.com/xyz');
      const result = await tool.handler({ action: 'invite_link', groupId: 'grp-1' }, ctx);
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.inviteLink).toBe('https://chat.whatsapp.com/xyz');
    });

    it('requires groupId', async () => {
      const result = await tool.handler({ action: 'invite_link' }, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('groupId');
    });
  });

  // ─── error handling ──────────────────────────────────────────────

  it('returns API error message on failure', async () => {
    mockListGroups.mockRejectedValue(new Error('Network timeout'));
    const result = await tool.handler({ action: 'list' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network timeout');
  });
});
