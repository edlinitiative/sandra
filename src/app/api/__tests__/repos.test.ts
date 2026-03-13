import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockGetConfiguredRepos, mockVectorStoreCount, mockEnv } = vi.hoisted(() => ({
  mockGetConfiguredRepos: vi.fn(),
  mockVectorStoreCount: vi.fn(),
  mockEnv: { ADMIN_API_KEY: 'test-key-for-repos' as string | undefined },
}));

vi.mock('@/lib/github', () => ({
  getConfiguredRepos: mockGetConfiguredRepos,
  findRepoConfig: vi.fn(),
}));

vi.mock('@/lib/knowledge', () => ({
  getVectorStore: () => ({
    count: mockVectorStoreCount,
  }),
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/repos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.ADMIN_API_KEY = 'test-key-for-repos';
    mockGetConfiguredRepos.mockReturnValue([
      {
        owner: 'edlinitiative',
        name: 'edlight-code',
        displayName: 'EdLight Code',
        description: 'Core platform',
        url: 'https://github.com/edlinitiative/edlight-code',
        branch: 'main',
        docsPath: 'docs',
        isActive: true,
      },
    ]);
    mockVectorStoreCount.mockResolvedValue(5);
  });

  it('returns 200 with repo list for valid API key', async () => {
    const { GET } = await import('../repos/route');
    const response = await GET(makeRequest('test-key-for-repos'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.repos).toHaveLength(1);
    expect(body.data.repos[0].name).toBe('edlight-code');
    expect(body.data.totalDocuments).toBe(5);
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
    mockGetConfiguredRepos.mockReturnValue([
      { owner: 'o', name: 'z-repo', displayName: 'Z Repo', url: '', isActive: true },
      { owner: 'o', name: 'a-repo', displayName: 'A Repo', url: '', isActive: true },
    ]);
    mockVectorStoreCount.mockResolvedValue(0);

    const { GET } = await import('../repos/route');
    const response = await GET(makeRequest('test-key-for-repos'));
    const body = await response.json();

    expect(body.data.repos[0].name).toBe('a-repo');
    expect(body.data.repos[1].name).toBe('z-repo');
  });
});
