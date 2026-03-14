import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockGetActiveRepos, mockEnv } = vi.hoisted(() => ({
  mockGetActiveRepos: vi.fn(),
  mockEnv: { ADMIN_API_KEY: 'test-key-for-repos' as string | undefined },
}));

vi.mock('@/lib/db', () => ({
  db: {},
  getActiveRepos: mockGetActiveRepos,
}));

vi.mock('@/lib/config', () => ({
  env: mockEnv,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(apiKey?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  return new Request('http://localhost/api/repos', { headers });
}

function makeRepo(overrides: Partial<{
  owner: string;
  name: string;
  displayName: string;
  url: string;
  syncStatus: string;
  lastSyncAt: Date | null;
  isActive: boolean;
}> = {}) {
  return {
    id: 'repo-1',
    owner: 'edlinitiative',
    name: 'edlight-code',
    displayName: 'EdLight Code',
    description: 'Core platform',
    url: 'https://github.com/edlinitiative/edlight-code',
    branch: 'main',
    docsPath: 'docs',
    isActive: true,
    syncStatus: 'not_indexed',
    lastSyncAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/repos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.ADMIN_API_KEY = 'test-key-for-repos';
    mockGetActiveRepos.mockResolvedValue([makeRepo()]);
  });

  it('returns 200 with repo list for valid API key', async () => {
    const { GET } = await import('../repos/route');
    const response = await GET(makeRequest('test-key-for-repos'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.repos).toHaveLength(1);
    expect(body.data.repos[0].name).toBe('edlight-code');
    expect(body.data.repos[0].syncStatus).toBe('not_indexed');
    expect(body.data.repos[0].lastIndexedAt).toBeNull();
    expect(body.meta.requestId).toBeDefined();
  });

  it('returns 401 without API key', async () => {
    const { GET } = await import('../repos/route');
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUTH_ERROR');
  });

  it('returns 401 with wrong API key', async () => {
    const { GET } = await import('../repos/route');
    const response = await GET(makeRequest('wrong-key'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('repos are sorted alphabetically by name', async () => {
    mockGetActiveRepos.mockResolvedValue([
      makeRepo({ name: 'z-repo', displayName: 'Z Repo' }),
      makeRepo({ name: 'a-repo', displayName: 'A Repo' }),
    ]);

    const { GET } = await import('../repos/route');
    const response = await GET(makeRequest('test-key-for-repos'));
    const body = await response.json();

    expect(body.data.repos[0].name).toBe('a-repo');
    expect(body.data.repos[1].name).toBe('z-repo');
  });

  it('returns lastIndexedAt as ISO string when lastSyncAt is set', async () => {
    const lastSyncAt = new Date('2026-01-15T10:00:00.000Z');
    mockGetActiveRepos.mockResolvedValue([makeRepo({ syncStatus: 'indexed', lastSyncAt })]);

    const { GET } = await import('../repos/route');
    const response = await GET(makeRequest('test-key-for-repos'));
    const body = await response.json();

    expect(body.data.repos[0].syncStatus).toBe('indexed');
    expect(body.data.repos[0].lastIndexedAt).toBe('2026-01-15T10:00:00.000Z');
  });
});
