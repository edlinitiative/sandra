import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockIndexRepositoriesByConfig,
  mockIndexAllRepositories,
  mockGetConfiguredRepos,
  mockGetActiveRepos,
  mockGetRepoByRepoId,
  mockEnv,
} =
  vi.hoisted(() => ({
    mockIndexRepositoriesByConfig: vi.fn(),
    mockIndexAllRepositories: vi.fn(),
    mockGetConfiguredRepos: vi.fn(),
    mockGetActiveRepos: vi.fn(),
    mockGetRepoByRepoId: vi.fn(),
    mockEnv: { ADMIN_API_KEY: 'test-index-key' as string | undefined },
  }));

vi.mock('@/lib/github', () => ({
  indexRepositoriesByConfig: mockIndexRepositoriesByConfig,
  indexAllRepositories: mockIndexAllRepositories,
  getConfiguredRepos: mockGetConfiguredRepos,
}));

vi.mock('@/lib/db', () => ({
  db: {},
  getActiveRepos: mockGetActiveRepos,
  getRepoByRepoId: mockGetRepoByRepoId,
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
  description: 'Core platform',
  url: 'https://github.com/edlinitiative/edlight-code',
  branch: 'main',
  docsPath: 'docs',
  isActive: true,
};

const mockRepoRecord = {
  id: 'repo-db-1',
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
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const mockIndexingResult = {
  repoId: 'repo-db-1',
  repoFullName: 'edlinitiative/edlight-code',
  status: 'completed',
  documentsProcessed: 10,
  documentsSkipped: 0,
  documentsFailed: 0,
  startedAt: new Date('2026-03-17T10:00:00.000Z'),
  completedAt: new Date('2026-03-17T10:00:01.000Z'),
  filesIndexed: 10,
  chunksCreated: 50,
  duration: 1000,
  errors: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.ADMIN_API_KEY = 'test-index-key';
    mockGetConfiguredRepos.mockReturnValue([mockRepoConfig]);
    mockGetActiveRepos.mockResolvedValue([mockRepoRecord]);
    mockGetRepoByRepoId.mockResolvedValue(mockRepoRecord);
    mockIndexRepositoriesByConfig.mockResolvedValue([mockIndexingResult]);
    mockIndexAllRepositories.mockResolvedValue([mockIndexingResult]);
  });

  it('returns 200 and triggers DB-backed indexing with valid repoId', async () => {
    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({ repoId: 'edlinitiative/edlight-code' }, 'test-index-key'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.results).toHaveLength(1);
    expect(body.data.summary).toMatchObject({
      total: 1,
      completed: 1,
      failed: 0,
      status: 'completed',
    });
    expect(mockIndexAllRepositories).toHaveBeenCalledWith(['repo-db-1']);
    expect(mockIndexRepositoriesByConfig).not.toHaveBeenCalled();
  });

  it('returns 200 with repoId as name only', async () => {
    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({ repoId: 'edlight-code' }, 'test-index-key'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockGetRepoByRepoId).toHaveBeenCalledWith({}, 'edlight-code');
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
    mockGetRepoByRepoId.mockResolvedValue(null);
    mockGetConfiguredRepos.mockReturnValue([]);

    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({ repoId: 'nonexistent/repo' }, 'test-index-key'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('indexes all active repos when repoId is omitted', async () => {
    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({}, 'test-index-key'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockIndexAllRepositories).toHaveBeenCalledWith(['repo-db-1']);
    expect(body.data.summary.status).toBe('completed');
  });

  it('falls back to configured repos when the DB repo is missing', async () => {
    mockGetRepoByRepoId.mockResolvedValue(null);

    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({ repoId: 'EdLight Code' }, 'test-index-key'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockIndexRepositoriesByConfig).toHaveBeenCalledWith([mockRepoConfig]);
  });

  it('returns partial success when some repositories fail during index-all', async () => {
    mockIndexAllRepositories.mockResolvedValue([
      mockIndexingResult,
      {
        ...mockIndexingResult,
        repoId: 'repo-db-2',
        repoFullName: 'edlinitiative/edlight-news',
        status: 'failed',
        documentsProcessed: 0,
        filesIndexed: 0,
        chunksCreated: 0,
        error: 'GitHub unavailable',
        errors: ['GitHub unavailable'],
      },
    ]);
    mockGetActiveRepos.mockResolvedValue([
      mockRepoRecord,
      { ...mockRepoRecord, id: 'repo-db-2', name: 'edlight-news', displayName: 'EdLight News' },
    ]);

    const { POST } = await import('../index/route');
    const response = await POST(makeRequest({}, 'test-index-key'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.summary).toMatchObject({
      total: 2,
      completed: 1,
      failed: 1,
      status: 'partial',
    });
  });
});
