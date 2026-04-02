import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockFindMany, mockCount } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    repoRegistry: { findMany: mockFindMany },
    indexedSource: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('@/lib/knowledge', () => ({
  getVectorStore: () => ({
    count: mockCount,
  }),
}));

vi.mock('@/lib/utils/auth', () => ({
  requireAdminAuth: vi.fn(),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/index/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCount.mockResolvedValue(100);
  });

  it('returns indexing status for all repos', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: '1',
        owner: 'edlinitiative',
        name: 'code',
        displayName: 'EdLight Code',
        syncStatus: 'indexed',
        lastSyncAt: new Date('2026-01-01'),
        isActive: true,
      },
      {
        id: '2',
        owner: 'edlinitiative',
        name: 'EdLight-News',
        displayName: 'EdLight News',
        syncStatus: 'not_indexed',
        lastSyncAt: null,
        isActive: true,
      },
    ]);

    const { GET } = await import('../index/status/route');
    const request = new Request('http://localhost/api/index/status', {
      headers: { 'x-api-key': 'test-key' },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.repos).toHaveLength(2);
    expect(body.data.repos[0]).toMatchObject({
      repoFullName: 'edlinitiative/code',
      syncStatus: 'indexed',
    });
    expect(body.data.summary.indexed).toBe(1);
    expect(body.data.summary.notIndexed).toBe(1);
    expect(body.data.summary.vectorStoreChunks).toBe(100);
  });

  it('requires admin authentication', async () => {
    const { requireAdminAuth } = await import('@/lib/utils/auth');
    const { AuthError } = await import('@/lib/utils/errors');
    vi.mocked(requireAdminAuth).mockImplementation(() => {
      throw new AuthError('Invalid or missing API key');
    });

    const { GET } = await import('../index/status/route');
    const request = new Request('http://localhost/api/index/status');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });
});
