import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockIndexRepositoriesByConfig, mockGetConfiguredRepos, mockFindRepoConfig, mockEnv } =
  vi.hoisted(() => ({
    mockIndexRepositoriesByConfig: vi.fn(),
    mockGetConfiguredRepos: vi.fn(),
    mockFindRepoConfig: vi.fn(),
    mockEnv: { ADMIN_API_KEY: 'test-index-key' as string | undefined },
  }));

vi.mock('@/lib/github', () => ({
  indexRepositoriesByConfig: mockIndexRepositoriesByConfig,
  indexAllRepositories: vi.fn(),
  getConfiguredRepos: mockGetConfiguredRepos,
  findRepoConfig: mockFindRepoConfig,
}));

vi.mock('@/lib/config', () => ({
  env: mockEnv,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, apiKey?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  return new Request('http://localhost/api/index', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const mockRepoConfig = {
  owner: 'edlinitiative',
  name: 'edlight-code',
  displayName: 'EdLight Code',
  url: 'https://github.com/edlinitiative/edlight-code',
  branch: 'main',
  docsPath: 'docs',
  isActive: true,
};

const mockIndexingResult = {
  repoId: 'edlinitiative/edlight-code',
  filesIndexed: 10,
  chunksCreated: 50,
  duration: 1000,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.ADMIN_API_KEY = 'test-index-key';
    mockFindRepoConfig.mockReturnValue(mockRepoConfig);
    mockGetConfiguredRepos.mockReturnValue([mockRepoConfig]);
    mockIndexRepositoriesByConfig.mockResolvedValue([mockIndexingResult]);
  });

  it('returns 200 and triggers indexing with valid repoId (owner/repo format)', async () => {
    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({ repoId: 'edlinitiative/edlight-code' }, 'test-index-key'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.results).toHaveLength(1);
    expect(mockIndexRepositoriesByConfig).toHaveBeenCalledWith([mockRepoConfig]);
  });

  it('returns 200 with repoId as name only', async () => {
    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({ repoId: 'edlight-code' }, 'test-index-key'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 401 without API key', async () => {
    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({ repoId: 'edlinitiative/edlight-code' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUTH_ERROR');
  });

  it('returns 404 for non-existent repoId', async () => {
    mockFindRepoConfig.mockReturnValue(null);
    mockGetConfiguredRepos.mockReturnValue([]);

    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({ repoId: 'nonexistent/repo' }, 'test-index-key'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for missing repoId', async () => {
    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({}, 'test-index-key'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
