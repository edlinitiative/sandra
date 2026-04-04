/**
 * Tests for Phase 14 Admin / Operations tools:
 *   manageTenantUsers, getUsageAnalytics, impersonateUserSession,
 *   createGithubIssue, getGithubPrStatus
 *
 * getUsageAnalytics summary response shape (breakdown='summary'):
 *   { period: {from, to}, totalEvents, byChannel, byEventType, averageResponseMs, cacheHitRate }
 *
 * getGithubPrStatus makes 4 fetch calls:
 *   1) PR details  2) reviews  3) dummy /commits/ (always → null)  4) sequential check-runs
 *
 * manageTenantUsers list response:
 *   { tenantId, memberCount, members: [{userId, name, email, role, joinedAt}] }
 *
 * impersonateUserSession response keys: profile, memory, recentActions, auditLog (dynamic)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockResolveTenantForUser = vi.fn().mockResolvedValue('tenant-1');
const mockGetTenantRole        = vi.fn().mockResolvedValue('admin');
const mockLogAuditEvent        = vi.fn().mockResolvedValue(undefined);

// Analytics
const mockGetAnalyticsSummary  = vi.fn();
const mockGetToolUsageStats    = vi.fn();

// Memory
const mockSaveMemory           = vi.fn().mockResolvedValue(undefined);
const mockGetMemories          = vi.fn().mockResolvedValue([]);

// GitHub — tools use raw fetch with headers from getGitHubClient()
const mockGitHubFetch          = vi.fn();

// DB mocks
const mockTenantMemberFindMany = vi.fn();
const mockTenantMemberCreate   = vi.fn();
const mockTenantMemberFindFirst = vi.fn();
const mockTenantMemberUpdate   = vi.fn();
const mockUserFindUnique       = vi.fn();
const mockActionRequestFindMany = vi.fn();
const mockAuditLogFindMany     = vi.fn();

vi.mock('@/lib/google/context', () => ({
  resolveTenantForUser: (...a: unknown[]) => mockResolveTenantForUser(...a),
  getTenantRole:        (...a: unknown[]) => mockGetTenantRole(...a),
  resolveGoogleContext: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/analytics', () => ({
  getAnalyticsSummary: (...a: unknown[]) => mockGetAnalyticsSummary(...a),
  getToolUsageStats:   (...a: unknown[]) => mockGetToolUsageStats(...a),
}));

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({
    saveMemory:   (...a: unknown[]) => mockSaveMemory(...a),
    getMemories:  (...a: unknown[]) => mockGetMemories(...a),
    getMemory:    vi.fn().mockResolvedValue(null),
    deleteMemory: vi.fn().mockResolvedValue(undefined),
  }),
  setUserMemoryStore: vi.fn(),
}));

vi.mock('@/lib/github/client', () => ({
  getGitHubClient: () => ({
    // The tools cast to { headers } and use raw fetch
    headers: { Authorization: 'Bearer test-gh-token', Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Sandra-AI-Agent' },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    tenantMember: {
      findMany:   (...a: unknown[]) => mockTenantMemberFindMany(...a),
      create:     (...a: unknown[]) => mockTenantMemberCreate(...a),
      findFirst:  (...a: unknown[]) => mockTenantMemberFindFirst(...a),
      update:     (...a: unknown[]) => mockTenantMemberUpdate(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
    actionRequest: {
      findMany:  (...a: unknown[]) => mockActionRequestFindMany(...a),
    },
    auditLog: {
      findMany:  (...a: unknown[]) => mockAuditLogFindMany(...a),
    },
  },
}));

// Stub global fetch for GitHub API calls
vi.stubGlobal('fetch', mockGitHubFetch);

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
  scopes:    ['admin:tools', 'repos:read'],
};

const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockGetTenantRole.mockResolvedValue('admin');
  mockGetMemories.mockResolvedValue([]);
  mockActionRequestFindMany.mockResolvedValue([]);
  mockAuditLogFindMany.mockResolvedValue([]);
});

// ─── manageTenantUsers ────────────────────────────────────────────────────────

describe('manageTenantUsers', () => {
  const tool = toolRegistry.get('manageTenantUsers')!;

  it('is registered with admin:tools scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('admin:tools');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({ action: 'list' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('rejects non-admin callers', async () => {
    mockGetTenantRole.mockResolvedValueOnce('basic');
    const result = await tool.handler({ action: 'list' }, adminCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('admin');
  });

  it('lists tenant members', async () => {
    mockTenantMemberFindMany.mockResolvedValueOnce([
      { userId: 'u-1', role: 'admin',   createdAt: new Date(), user: { name: 'Alice', email: 'alice@test.org', createdAt: new Date() } },
      { userId: 'u-2', role: 'basic',   createdAt: new Date(), user: { name: 'Bob',   email: 'bob@test.org',   createdAt: new Date() } },
    ]);

    const result = await tool.handler({ action: 'list' }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { memberCount: number; members: unknown[] };
    expect(data.memberCount).toBe(2);
    expect(data.members).toHaveLength(2);
  });

  it('rejects invite without email', async () => {
    // email is required for invite — Zod schema validation should catch it in handler
    const result = await tool.handler({ action: 'invite', role: 'basic' }, adminCtx);
    expect(result.success).toBe(false);
  });
});

// ─── getUsageAnalytics ────────────────────────────────────────────────────────

describe('getUsageAnalytics', () => {
  const tool = toolRegistry.get('getUsageAnalytics')!;

  it('is registered with admin:tools scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('admin:tools');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns summary analytics', async () => {
    mockGetAnalyticsSummary.mockResolvedValueOnce({
      period: { from: new Date('2026-04-01'), to: new Date('2026-04-02') },
      totalEvents: 100,
      byChannel: { web: 60, whatsapp: 40 },
      byEventType: {},
      averageResponseMs: 800,
      cacheHitRate: 0.35,
    });
    const result = await tool.handler({ breakdown: 'summary' }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { totalEvents: number };
    expect(data.totalEvents).toBe(100);
  });

  it('returns tool usage stats', async () => {
    mockGetToolUsageStats.mockResolvedValueOnce([
      { tool: 'searchKnowledge', calls: 50, successRate: 0.98 },
    ]);
    const result = await tool.handler({ breakdown: 'tools' }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { toolUsage: unknown[] };
    expect(data.toolUsage).toHaveLength(1);
  });
});

// ─── impersonateUserSession ───────────────────────────────────────────────────

describe('impersonateUserSession', () => {
  const tool = toolRegistry.get('impersonateUserSession')!;

  it('is registered with admin:tools scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('admin:tools');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({ email: 'bob@test.org' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns error when user not found', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const result = await tool.handler({ email: 'nobody@test.org' }, adminCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No user found');
  });

  it('returns user profile and memory', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'u-1', name: 'Bob', email: 'bob@test.org', role: 'basic',
      language: 'fr', channel: 'web', createdAt: new Date(),
      tenantMembers: [{ tenantId: 'tenant-1', role: 'basic' }],
    });
    mockGetMemories.mockResolvedValueOnce([
      { key: 'city', value: 'Port-au-Prince', source: 'user_explicit', confidence: 1.0, updatedAt: new Date() },
    ]);

    const result = await tool.handler({ email: 'bob@test.org', include: ['profile', 'memory'] }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { profile: { email: string }; memory: unknown[] };
    expect(data.profile.email).toBe('bob@test.org');
    expect(data.memory).toHaveLength(1);
  });
});

// ─── createGithubIssue ────────────────────────────────────────────────────────

describe('createGithubIssue', () => {
  const tool = toolRegistry.get('createGithubIssue')!;

  it('is registered with admin:tools scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('admin:tools');
  });

  it('rejects missing required params', async () => {
    await expect(tool.handler({ owner: 'edlinitiative' }, adminCtx)).rejects.toThrow();
  });

  it('creates a GitHub issue and returns issue info', async () => {
    mockGitHubFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        number: 42,
        title: 'Bug report',
        html_url: 'https://github.com/edlinitiative/sandra/issues/42',
        state: 'open',
        created_at: '2026-04-03T00:00:00Z',
      }),
    });

    const result = await tool.handler({
      owner: 'edlinitiative', repo: 'sandra', title: 'Bug report', body: 'Found a bug',
    }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { issueNumber: number; url: string };
    expect(data.issueNumber).toBe(42);
    expect(data.url).toContain('issues/42');
  });

  it('returns error when repo not found', async () => {
    mockGitHubFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    const result = await tool.handler({ owner: 'bad', repo: 'repo', title: 'Test' }, adminCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ─── getGithubPrStatus ────────────────────────────────────────────────────────

describe('getGithubPrStatus', () => {
  const tool = toolRegistry.get('getGithubPrStatus')!;

  it('is registered with repos:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('repos:read');
  });

  it('rejects missing pullNumber', async () => {
    await expect(tool.handler({ owner: 'edlinitiative', repo: 'sandra' }, adminCtx)).rejects.toThrow();
  });

  it('returns PR status', async () => {
    // Tool makes 3 parallel fetches (PR, reviews, dummy commits) then 1 sequential (check-runs)
    mockGitHubFetch
      // 1) PR details (include head.sha for check-runs URL)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          number: 5, title: 'Feature: new tools',
          html_url: 'https://github.com/edlinitiative/sandra/pull/5',
          state: 'open', draft: false, merged: false, mergeable: true, mergeable_state: 'clean',
          user: { login: 'dev1' },
          head: { ref: 'feature/tools', sha: 'abc123' },
          base: { ref: 'main' },
          created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-03T00:00:00Z',
          additions: 10, deletions: 2, changed_files: 3,
        }),
      })
      // 2) Reviews
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2026-04-02T00:00:00Z' },
        ]),
      })
      // 3) Dummy /commits/ — tool does .then(() => null), result is always discarded
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      // 4) Sequential check-runs fetch (after getting pr.head.sha)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ check_runs: [] }),
      });

    const result = await tool.handler({ owner: 'edlinitiative', repo: 'sandra', pullNumber: 5 }, adminCtx);
    expect(result.success).toBe(true);
    const data = result.data as { pr: { number: number }; reviews: { approvals: number } };
    expect(data.pr.number).toBe(5);
    expect(data.reviews.approvals).toBeGreaterThanOrEqual(1);
  });

  it('returns error when PR not found', async () => {
    // All 3 parallel fetches run, even though PR returns 404
    mockGitHubFetch
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })  // PR
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) })                // reviews (discarded)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });               // dummy commits
    const result = await tool.handler({ owner: 'bad', repo: 'repo', pullNumber: 999 }, adminCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
