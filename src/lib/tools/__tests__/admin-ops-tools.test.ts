/**
 * Tests for Phase 14 Admin & Ops tools:
 *   manageTenantUsers, getUsageAnalytics, impersonateUserSession,
 *   createGithubIssue, getGithubPrStatus
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveTenantForUser = vi.fn().mockResolvedValue('tenant-1');
const mockGetTenantRole        = vi.fn().mockResolvedValue('admin');
const mockLogAuditEvent        = vi.fn().mockResolvedValue(undefined);
const mockGetAnalyticsSummary  = vi.fn();
const mockGetToolUsageStats    = vi.fn();
const mockGetGitHubClient      = vi.fn();

// DB mocks
const mockTenantMemberFindMany  = vi.fn();
const mockTenantMemberUpsert    = vi.fn();
const mockTenantMemberUpdateMany = vi.fn();
const mockUserFindUnique        = vi.fn();
const mockUserCreate            = vi.fn();
const mockActionRequestFindMany = vi.fn();
const mockAuditLogFindMany      = vi.fn();

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext:  vi.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  resolveTenantForUser:  (...a: unknown[]) => mockResolveTenantForUser(...a),
  getTenantRole:         (...a: unknown[]) => mockGetTenantRole(...a),
}));

vi.mock('@/lib/analytics', () => ({
  getAnalyticsSummary:  (...a: unknown[]) => mockGetAnalyticsSummary(...a),
  getToolUsageStats:    (...a: unknown[]) => mockGetToolUsageStats(...a),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({
    getMemories: vi.fn().mockResolvedValue([
      { key: 'language', value: 'French', source: 'user_explicit', confidence: 1.0, updatedAt: new Date() },
    ]),
  }),
}));

vi.mock('@/lib/github/client', () => ({
  getGitHubClient: (...a: unknown[]) => mockGetGitHubClient(...a),
}));

vi.mock('@/lib/db', () => ({
  db: {
    tenantMember: {
      findMany:    (...a: unknown[]) => mockTenantMemberFindMany(...a),
      upsert:      (...a: unknown[]) => mockTenantMemberUpsert(...a),
      updateMany:  (...a: unknown[]) => mockTenantMemberUpdateMany(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      create:     (...a: unknown[]) => mockUserCreate(...a),
    },
    actionRequest: {
      findMany: (...a: unknown[]) => mockActionRequestFindMany(...a),
    },
    auditLog: {
      findMany: (...a: unknown[]) => mockAuditLogFindMany(...a),
    },
  },
}));

// ─── Import tools ─────────────────────────────────────────────────────────────

import '@/lib/tools/manage-tenant-users';
import '@/lib/tools/get-usage-analytics';
import '@/lib/tools/impersonate-user-session';
import '@/lib/tools/create-github-issue';
import '@/lib/tools/get-github-pr-status';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Contexts ────────────────────────────────────────────────────────────────

const adminCtx: ToolContext = {
  sessionId: 'sess-admin',
  userId:    'admin-1',
  scopes:    ['admin:tools'],
};

const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockGetTenantRole.mockResolvedValue('admin');
  mockLogAuditEvent.mockResolvedValue(undefined);
});

// ─── manageTenantUsers ────────────────────────────────────────────────────────

describe('manageTenantUsers', () => {
  const tool = toolRegistry.get('manageTenantUsers')!;

  it('is registered with admin:tools scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('admin:tools');
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler({ action: 'list' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns error when user is not an admin', async () => {
    mockGetTenantRole.mockResolvedValueOnce('basic');
    const result = await tool.handler({ action: 'list' }, adminCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('admin');
  });

  it('lists tenant members', async () => {
    mockTenantMemberFindMany.mockResolvedValueOnce([
      { userId: 'u1', role: 'basic', createdAt: new Date(), user: { name: 'Alice', email: 'alice@test.org', createdAt: new Date() } },
      { userId: 'u2', role: 'admin', createdAt: new Date(), user: { name: 'Bob',   email: 'bob@test.org',   createdAt: new Date() } },
    ]);

    const result = await tool.handler({ action: 'list' }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { memberCount: number; members: unknown[] };
    expect(data.memberCount).toBe(2);
    expect(data.members).toHaveLength(2);
  });

  it('invites a new user', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate.mockResolvedValueOnce({ id: 'new-u1', email: 'charlie@test.org' });
    mockTenantMemberUpsert.mockResolvedValueOnce({ tenantId: 'tenant-1', userId: 'new-u1', role: 'basic' });

    const result = await tool.handler({ action: 'invite', email: 'charlie@test.org', role: 'basic' }, adminCtx);
    expect(result.success).toBe(true);
    expect((result.data as { confirmation: string }).confirmation).toContain('charlie@test.org');
  });

  it('removes a user', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'u1', email: 'alice@test.org' });
    mockTenantMemberUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await tool.handler({ action: 'remove', email: 'alice@test.org' }, adminCtx);
    expect(result.success).toBe(true);
    expect((result.data as { confirmation: string }).confirmation).toContain('alice@test.org');
  });

  it('returns error when removing non-existent user', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const result = await tool.handler({ action: 'remove', email: 'ghost@test.org' }, adminCtx);
    expect(result.success).toBe(false);
  });
});

// ─── getUsageAnalytics ────────────────────────────────────────────────────────

describe('getUsageAnalytics', () => {
  const tool = toolRegistry.get('getUsageAnalytics')!;

  const fakeSummary = {
    totalEvents: 500,
    byEventType: { message_sent: 200, tool_executed: 150 },
    byChannel:   { whatsapp: 300, web: 200 },
    byLanguage:  { ht: 250, fr: 150, en: 100 },
    topTools:    [{ tool: 'searchKnowledgeBase', count: 100 }],
    averageResponseMs: 1200,
    cacheHitRate:      0.35,
    period:            { from: new Date('2026-03-01'), to: new Date('2026-04-01') },
  };

  it('is registered with admin:tools scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('admin:tools');
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns summary analytics', async () => {
    mockGetAnalyticsSummary.mockResolvedValueOnce(fakeSummary);
    const result = await tool.handler({ breakdown: 'summary' }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { totalEvents: number };
    expect(data.totalEvents).toBe(500);
  });

  it('returns tool-only breakdown', async () => {
    mockGetToolUsageStats.mockResolvedValueOnce([
      { tool: 'searchKnowledgeBase', count: 100 },
      { tool: 'readGmail', count: 40 },
    ]);
    const result = await tool.handler({ breakdown: 'tools' }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { toolUsage: Array<{ tool: string }> };
    expect(data.toolUsage[0].tool).toBe('searchKnowledgeBase');
  });

  it('returns full analytics breakdown', async () => {
    mockGetAnalyticsSummary.mockResolvedValueOnce(fakeSummary);
    const result = await tool.handler({ breakdown: 'full' }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { topTools: unknown[]; byLanguage: Record<string, number> };
    expect(data.topTools).toBeDefined();
    expect(data.byLanguage).toBeDefined();
  });

  it('rejects invalid date strings', async () => {
    const result = await tool.handler({ fromDate: 'not-a-date' }, adminCtx);
    expect(result.success).toBe(false);
  });
});

// ─── impersonateUserSession ───────────────────────────────────────────────────

describe('impersonateUserSession', () => {
  const tool = toolRegistry.get('impersonateUserSession')!;

  it('is registered with admin:tools scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('admin:tools');
  });

  it('always logs an audit event', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'u1', name: 'Alice', email: 'alice@test.org', role: 'student',
      language: 'ht', channel: 'whatsapp', createdAt: new Date(),
      tenantMembers: [],
    });
    mockActionRequestFindMany.mockResolvedValueOnce([]);

    await tool.handler({ email: 'alice@test.org' }, adminCtx);
    expect(mockLogAuditEvent).toHaveBeenCalled();
  });

  it('returns error for unknown user', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const result = await tool.handler({ email: 'unknown@test.org' }, adminCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No user found');
  });

  it('returns user profile, memory, and sessions', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'u1', name: 'Alice', email: 'alice@test.org', role: 'student',
      language: 'ht', channel: 'whatsapp', createdAt: new Date(),
      tenantMembers: [{ tenantId: 'tenant-1', role: 'basic' }],
    });
    mockActionRequestFindMany.mockResolvedValueOnce([
      { id: 'ar-1', tool: 'readGmail', status: 'completed', channel: 'web', createdAt: new Date(), input: {} },
    ]);

    const result = await tool.handler({ email: 'alice@test.org' }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { profile: { email: string }; recentActions: unknown[]; note: string };
    expect(data.profile.email).toBe('alice@test.org');
    expect(data.recentActions).toHaveLength(1);
    expect(data.note).toContain('READ-ONLY');
  });
});

// ─── createGithubIssue ────────────────────────────────────────────────────────

describe('createGithubIssue', () => {
  const tool = toolRegistry.get('createGithubIssue')!;
  const mockFetch = vi.fn();

  beforeEach(() => {
    // Set up mock fetch on the GitHubClient
    const fakeClient = {
      headers: { Authorization: 'Bearer test-token', Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Sandra-AI-Agent' },
    };
    mockGetGitHubClient.mockReturnValue(fakeClient);
    vi.stubGlobal('fetch', mockFetch);
  });

  it('is registered with admin:tools scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('admin:tools');
  });

  it('rejects missing required params', async () => {
    await expect(tool.handler({ owner: 'edlinitiative' }, adminCtx)).rejects.toThrow();
  });

  it('creates issue and returns number + URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        number: 42, title: 'Bug: login fails', html_url: 'https://github.com/org/repo/issues/42',
        state: 'open', created_at: '2026-04-03T10:00:00Z',
      }),
    });

    const result = await tool.handler(
      { owner: 'edlinitiative', repo: 'sandra', title: 'Bug: login fails', body: 'Steps to reproduce...' },
      adminCtx,
    );
    expect(result.success).toBe(true);
    const data = result.data as { issueNumber: number; url: string };
    expect(data.issueNumber).toBe(42);
    expect(data.url).toContain('issues/42');
  });

  it('handles 404 repo not found', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    const result = await tool.handler(
      { owner: 'no-org', repo: 'no-repo', title: 'Test' },
      adminCtx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler(
      { owner: 'org', repo: 'repo', title: 'Issue' },
      anonCtx,
    );
    expect(result.success).toBe(false);
  });
});

// ─── getGithubPrStatus ────────────────────────────────────────────────────────

describe('getGithubPrStatus', () => {
  const tool = toolRegistry.get('getGithubPrStatus')!;
  const mockFetch = vi.fn();

  const fakePr = {
    number: 7, title: 'feat: add new tool', state: 'open', draft: false, merged: false,
    mergeable: true, mergeable_state: 'clean', html_url: 'https://github.com/org/repo/pull/7',
    head: { ref: 'feature/tool', sha: 'abc123' },
    base: { ref: 'main' },
    user: { login: 'devuser' },
    created_at: '2026-04-01T08:00:00Z', updated_at: '2026-04-03T10:00:00Z',
    body: 'Adds a new tool.', additions: 120, deletions: 30, changed_files: 5,
  };

  beforeEach(() => {
    const fakeClient = {
      headers: { Authorization: 'Bearer test-token', Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Sandra-AI-Agent' },
    };
    mockGetGitHubClient.mockReturnValue(fakeClient);
    vi.stubGlobal('fetch', mockFetch);
  });

  it('is registered with repos:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('repos:read');
  });

  it('rejects missing params', async () => {
    await expect(tool.handler({ owner: 'org' }, adminCtx)).rejects.toThrow();
  });

  it('returns PR details, reviews, checks and mergeability', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => fakePr })           // PR fetch
      .mockResolvedValueOnce({ ok: true, json: async () => [                    // reviews
        { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2026-04-02T12:00:00Z' },
      ]})
      .mockResolvedValueOnce(null)                                              // commits (not used)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ check_runs: [    // check runs
        { name: 'CI Tests', status: 'completed', conclusion: 'success' },
      ]})});

    const result = await tool.handler({ owner: 'org', repo: 'repo', pullNumber: 7 }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as {
      pr:           { number: number; title: string };
      reviews:      { approvals: number };
      checks:       { passed: number; failed: number };
      mergeability: { readyToMerge: boolean; blockers: string[] };
    };
    expect(data.pr.number).toBe(7);
    expect(data.reviews.approvals).toBe(1);
    expect(data.checks.passed).toBe(1);
    expect(data.checks.failed).toBe(0);
    expect(data.mergeability.readyToMerge).toBe(true);
    expect(data.mergeability.blockers).toHaveLength(0);
  });

  it('correctly identifies draft PRs as not ready', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...fakePr, draft: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ check_runs: [] }) });

    const result = await tool.handler({ owner: 'org', repo: 'repo', pullNumber: 7 }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { mergeability: { readyToMerge: boolean; blockers: string[] } };
    expect(data.mergeability.readyToMerge).toBe(false);
    expect(data.mergeability.blockers.some((b) => b.includes('draft'))).toBe(true);
  });

  it('handles 404 for missing PRs', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await tool.handler({ owner: 'org', repo: 'repo', pullNumber: 999 }, adminCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
