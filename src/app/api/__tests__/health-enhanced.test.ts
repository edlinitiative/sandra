import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    repoRegistry: { count: vi.fn().mockResolvedValue(4) },
    indexedSource: { count: vi.fn().mockResolvedValue(4) },
    indexedDocument: { count: vi.fn().mockResolvedValue(300) },
  },
}));

vi.mock('@/lib/knowledge', () => ({
  getVectorStore: () => ({
    count: vi.fn().mockResolvedValue(294),
  }),
}));

vi.mock('@/lib/config', () => ({
  APP_NAME: 'Sandra',
  APP_VERSION: '0.1.0',
}));

vi.mock('@/lib/tools', () => ({
  toolRegistry: {
    getToolNames: vi.fn().mockReturnValue(['searchKnowledgeBase', 'getCourseInventory']),
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/health (enhanced)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes uptime, latency, and memory in response', async () => {
    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');

    // New fields
    expect(body.uptime).toBeDefined();
    expect(body.uptime.seconds).toBeGreaterThanOrEqual(0);
    expect(body.uptime.human).toMatch(/\d+s/);

    expect(body.latency).toBeDefined();
    expect(body.latency.database).toMatch(/\d+ms/);

    expect(body.memory).toBeDefined();
    expect(body.memory.rss).toMatch(/MB$/);
    expect(body.memory.heapUsed).toMatch(/MB$/);
    expect(body.memory.heapTotal).toMatch(/MB$/);

    // Existing fields still present
    expect(body.checks.database).toBe('ok');
    expect(body.checks.vectorStore).toBe('ok');
    expect(body.summary.repos).toBeDefined();
    expect(body.summary.tools.count).toBe(2);
  });
});
