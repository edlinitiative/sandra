import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockQueryRaw, mockVectorStoreCount } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockVectorStoreCount: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('@/lib/knowledge', () => ({
  getVectorStore: () => ({
    count: mockVectorStoreCount,
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(body.checks.database).toContain('error');
    expect(body.checks.vectorStore).toBe('ok');
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
