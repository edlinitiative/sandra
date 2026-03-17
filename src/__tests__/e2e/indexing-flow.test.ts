/**
 * T121: End-to-End Indexing Pipeline Verification
 *
 * Tests the full indexing flow:
 *   1. Ingest documents through chunk → embed → store pipeline
 *   2. After indexing, retrieveContext() returns results for related query
 *   3. Re-indexing with same content is idempotent (upsert deduplication)
 *   4. GET /api/repos returns repository list (admin)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryVectorStore } from '@/lib/knowledge/vector-store';
import { ingestDocuments } from '@/lib/knowledge/ingest';
import type { RawDocument } from '@/lib/knowledge/types';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockEmbedChunks, mockEmbedQuery } = vi.hoisted(() => ({
  mockEmbedChunks: vi.fn(),
  mockEmbedQuery: vi.fn(),
}));

const { mockGetActiveRepoSummaries } = vi.hoisted(() => ({
  mockGetActiveRepoSummaries: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock embeddings to return consistent, non-zero vectors so cosine similarity = 1.0
vi.mock('@/lib/knowledge/embeddings', () => ({
  embedChunks: mockEmbedChunks,
  embedQuery: mockEmbedQuery,
}));

vi.mock('@/lib/db', () => ({
  db: {},
  getActiveRepoSummaries: mockGetActiveRepoSummaries,
}));

vi.mock('@/lib/utils/auth', () => ({
  requireAdminAuth: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a 1536-dim unit vector along the first axis */
function unitVector(): number[] {
  const v = new Array(1536).fill(0) as number[];
  v[0] = 1;
  return v;
}

const TEST_DOCUMENT: RawDocument = {
  sourceId: 'test-org/test-repo',
  title: 'EdLight Academy — Getting Started',
  path: 'docs/getting-started.md',
  content: `# Getting Started with EdLight Academy

EdLight Academy is an educational platform that helps teachers and students
collaborate more effectively. This guide covers installation and setup.

## Installation

Run the following command to install the package:
\`\`\`
npm install @edlight/academy
\`\`\`

## Configuration

Create a \`.env\` file with your API credentials.`,
  metadata: { repo: 'test-org/test-repo', url: 'https://github.com/test-org/test-repo' },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('T121: End-to-End Indexing Pipeline', () => {
  let vectorStore: InMemoryVectorStore;

  beforeEach(() => {
    vi.clearAllMocks();

    // Each test gets a fresh vector store
    vectorStore = new InMemoryVectorStore();

    // Mock embedChunks: assign unit vector to each chunk
    mockEmbedChunks.mockImplementation(async (chunks: Array<{ contentHash: string; sourceId: string; content: string; title?: string; path?: string; metadata?: unknown }>) =>
      chunks.map((chunk) => ({
        ...chunk,
        embedding: unitVector(),
      })),
    );

    // Mock embedQuery: return unit vector so cosine similarity = 1.0 vs stored chunks
    mockEmbedQuery.mockResolvedValue(unitVector());
  });

  it('ingest pipeline processes documents through chunk → embed → store', async () => {
    // Use real vector store via setVectorStore
    const { setVectorStore } = await import('@/lib/knowledge/vector-store');
    setVectorStore(vectorStore);

    const result = await ingestDocuments([TEST_DOCUMENT]);

    expect(result.totalDocuments).toBe(1);
    expect(result.totalChunks).toBeGreaterThan(0);
    expect(mockEmbedChunks).toHaveBeenCalledOnce();

    const count = await vectorStore.count();
    expect(count).toBe(result.totalChunks);
  });

  it('after indexing, retrieveContext returns results for a related query', async () => {
    const { setVectorStore } = await import('@/lib/knowledge/vector-store');
    setVectorStore(vectorStore);

    // Ingest the test document
    await ingestDocuments([TEST_DOCUMENT]);

    // Now retrieve context using real retrieval (with mocked embedQuery)
    const { retrieveContext } = await import('@/lib/knowledge/retrieval');
    const results = await retrieveContext('EdLight Academy installation guide', {
      topK: 3,
      minScore: 0.0, // Use 0 since all vectors are identical (cosine sim = 1.0)
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.score).toBeGreaterThan(0);
    // Content should come from our test document
    expect(results[0]!.chunk.sourceId).toBe('test-org/test-repo');
  });

  it('re-indexing with identical content is idempotent (upsert deduplication)', async () => {
    const { setVectorStore } = await import('@/lib/knowledge/vector-store');
    setVectorStore(vectorStore);

    // Ingest once
    const first = await ingestDocuments([TEST_DOCUMENT]);
    const countAfterFirst = await vectorStore.count();

    // Ingest same document again
    const second = await ingestDocuments([TEST_DOCUMENT]);
    const countAfterSecond = await vectorStore.count();

    expect(first.totalChunks).toBeGreaterThan(0);
    expect(second.totalChunks).toBe(first.totalChunks);
    // Upsert by contentHash means the count stays the same
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('GET /api/repos returns repository list with syncStatus', async () => {
    mockGetActiveRepoSummaries.mockResolvedValue([
      {
        id: 'repo-1',
        name: 'edlight-code',
        displayName: 'EdLight Code',
        description: 'Coding courses',
        url: 'https://github.com/edlight/code',
        syncStatus: 'indexed',
        owner: 'edlight',
        branch: 'main',
        docsPath: 'docs',
        isActive: true,
        indexedDocumentCount: 12,
        lastIndexedAt: new Date('2024-01-01T12:00:00Z'),
      },
      {
        id: 'repo-2',
        name: 'edlight-academy',
        displayName: 'EdLight Academy',
        description: 'Academic learning',
        url: 'https://github.com/edlight/academy',
        syncStatus: 'pending',
        owner: 'edlight',
        branch: 'main',
        docsPath: 'docs',
        isActive: true,
        indexedDocumentCount: 0,
        lastIndexedAt: null,
      },
    ]);

    const { GET } = await import('../../app/api/repos/route');
    const request = new Request('http://localhost/api/repos', {
      headers: { Authorization: 'Bearer test-admin-key' },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.repos).toHaveLength(2);

    const indexed = body.data.repos.find((r: { name: string }) => r.name === 'edlight-code');
    expect(indexed).toBeDefined();
    expect(indexed.syncStatus).toBe('indexed');
    expect(indexed.lastIndexedAt).toBeDefined();
    expect(indexed.indexedDocumentCount).toBe(12);
  });

  it('indexed content is retrievable via search after ingestion', async () => {
    const { setVectorStore } = await import('@/lib/knowledge/vector-store');
    setVectorStore(vectorStore);

    // Ingest a document with specific content
    const doc: RawDocument = {
      sourceId: 'edlight/initiative',
      title: 'EdLight Initiative — Mission',
      path: 'README.md',
      content: 'EdLight Initiative mission: accessible education for all communities worldwide.',
      metadata: {},
    };

    await ingestDocuments([doc]);

    const { retrieveContext } = await import('@/lib/knowledge/retrieval');
    const results = await retrieveContext('EdLight mission accessibility', { topK: 5, minScore: 0 });

    expect(results.length).toBeGreaterThan(0);
    const allContent = results.map((r) => r.chunk.content).join(' ');
    expect(allContent).toContain('EdLight Initiative');
  });
});
