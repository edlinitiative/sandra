import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockQueryRaw,
  mockRepoRegistryCount,
  mockIndexedSourceCount,
  mockIndexedDocumentCount,
  mockVectorStoreCount,
  mockGetToolNames,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockRepoRegistryCount: vi.fn(),
  mockIndexedSourceCount: vi.fn(),
  mockIndexedDocumentCount: vi.fn(),
  mockVectorStoreCount: vi.fn(),
  mockGetToolNames: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: mockQueryRaw,
    repoRegistry: {
      count: mockRepoRegistryCount,
    },
    indexedSource: {
      count: mockIndexedSourceCount,
    },
    indexedDocument: {
      count: mockIndexedDocumentCount,
    },
  },
}));

vi.mock('@/lib/knowledge', () => ({
  getVectorStore: () => ({
    count: mockVectorStoreCount,
  }),
}));

vi.mock('@/lib/config', () => ({
  APP_NAME: 'Sandra',
  APP_VERSION: '1.0.0',
}));

vi.mock('@/lib/tools', () => ({
  toolRegistry: {
    getToolNames: mockGetToolNames,
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepoRegistryCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockIndexedSourceCount.mockResolvedValue(4);
    mockIndexedDocumentCount.mockResolvedValue(24);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase', 'getCourseInventory']);
  });

  it('returns 200 with status ok when all checks pass', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockVectorStoreCount.mockResolvedValue(42);

    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('ok');
    expect(body.checks.vectorStore).toBe('ok');
    expect(body.summary.repos).toMatchObject({
      total: 4,
      active: 4,
      indexed: 2,
      indexing: 1,
      error: 1,
    });
    expect(body.summary.tools).toMatchObject({
      count: 2,
      registered: ['searchKnowledgeBase', 'getCourseInventory'],
    });
    expect(body.summary.knowledge).toMatchObject({
      indexedSources: 4,
      indexedDocuments: 24,
      vectorStoreChunks: 42,
    });
    expect(body.timestamp).toBeDefined();
  });

  it('returns 503 with status degraded when database check fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'));
    mockVectorStoreCount.mockResolvedValue(0);

    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe('unavailable');
    expect(body.checks.vectorStore).toBe('ok');
    expect(body.summary.repos.total).toBeNull();
  });

  it('returns 503 with status degraded when vector store check fails', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockVectorStoreCount.mockRejectedValue(new Error('Vector store unavailable'));

    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe('ok');
    expect(body.checks.vectorStore).toContain('error');
    expect(body.summary.knowledge.vectorStoreChunks).toBeNull();
  });

  it('includes timestamp in response', async () => {
    mockQueryRaw.mockResolvedValue([]);
    mockVectorStoreCount.mockResolvedValue(0);

    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
