/**
 * T128: Performance Baseline
 *
 * Sanity-checks that key operations stay within acceptable time bounds:
 *   - Health endpoint < 500ms
 *   - Chat endpoint (mocked LLM) < 1 second
 *   - Vector store search with 1000 documents < 500ms
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryVectorStore } from '@/lib/knowledge/vector-store';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRunSandraAgent } = vi.hoisted(() => ({
  mockRunSandraAgent: vi.fn(),
}));

const { mockQueryRaw, mockVectorStoreCount } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockVectorStoreCount: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/agents', () => ({
  runSandraAgent: mockRunSandraAgent,
  runSandraAgentStream: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  env: { OPENAI_API_KEY: 'sk-test-validkeyfortesting' },
}));

vi.mock('@/lib/i18n', () => ({
  resolveLanguage: ({ explicit }: { explicit?: string }) => explicit ?? 'en',
}));

vi.mock('@/lib/db', () => ({
  db: { $queryRaw: mockQueryRaw },
}));

vi.mock('@/lib/knowledge', () => ({
  getVectorStore: () => ({ count: mockVectorStoreCount }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a 1536-dim random unit vector */
function randomVector(seed: number): number[] {
  const v = new Array(1536).fill(0) as number[];
  // Simple deterministic pseudo-random for reproducibility
  v[seed % 1536] = 1;
  v[(seed * 7 + 13) % 1536] = 0.5;
  return v;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('T128: Performance Baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('health endpoint responds in < 500ms', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockVectorStoreCount.mockResolvedValue(42);

    const { GET } = await import('../../app/api/health/route');

    const start = Date.now();
    const response = await GET();
    const elapsed = Date.now() - start;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(500);
  });

  it('chat endpoint (mocked LLM) responds in < 1 second', async () => {
    mockRunSandraAgent.mockResolvedValue({
      response: 'Hello from Sandra!',
      language: 'en',
      toolsUsed: [],
      retrievalUsed: false,
      tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

    const { POST } = await import('../../app/api/chat/route');
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Tell me about EdLight' }),
    });

    const start = Date.now();
    const response = await POST(request);
    const elapsed = Date.now() - start;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(1000);
  });

  it('vector store search with 1000 documents completes in < 500ms', async () => {
    const store = new InMemoryVectorStore();

    // Populate with 1000 fake documents
    const chunks = Array.from({ length: 1000 }, (_, i) => ({
      id: `chunk-${i}`,
      sourceId: `source-${Math.floor(i / 10)}`,
      title: `Document ${i}`,
      content: `Content for document ${i}`,
      path: `doc-${i}.md`,
      chunkIndex: i % 10,
      chunkTotal: 10,
      contentHash: `hash-${i}`,
      embedding: randomVector(i),
      metadata: { index: i },
    }));

    await store.upsert(chunks);
    expect(await store.count()).toBe(1000);

    const queryVector = randomVector(42);

    const start = Date.now();
    const results = await store.search(queryVector, 10);
    const elapsed = Date.now() - start;

    expect(results).toHaveLength(10);
    expect(elapsed).toBeLessThan(500);
  });

  it('InMemoryVectorStore upsert of 1000 chunks completes in < 2 seconds', async () => {
    const store = new InMemoryVectorStore();

    const chunks = Array.from({ length: 1000 }, (_, i) => ({
      id: `chunk-${i}`,
      sourceId: `source-0`,
      title: `Document ${i}`,
      content: `Content ${i}`,
      path: `doc-${i}.md`,
      chunkIndex: i,
      chunkTotal: 1000,
      contentHash: `hash-${i}`,
      embedding: randomVector(i),
      metadata: {},
    }));

    const start = Date.now();
    await store.upsert(chunks);
    const elapsed = Date.now() - start;

    expect(await store.count()).toBe(1000);
    expect(elapsed).toBeLessThan(2000);
  });
});
