import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { mockPrismaClient, resetPrismaMocks } from '@/lib/__tests__/mocks/prisma';

// Mock DB
vi.mock('@/lib/db/client', () => ({
  db: mockPrismaClient as unknown as PrismaClient,
}));

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
  return actual;
});

// Hoist mock functions so they're available in vi.mock factory
const { mockFetchRepoContent, mockIngestDocuments, mockRemoveSource } = vi.hoisted(() => ({
  mockFetchRepoContent: vi.fn(),
  mockIngestDocuments: vi.fn(),
  mockRemoveSource: vi.fn(),
}));

vi.mock('../fetcher', () => ({
  fetchRepoContent: mockFetchRepoContent,
  fetchRepoDocuments: vi.fn(),
}));

vi.mock('@/lib/knowledge', () => ({
  ingestDocuments: mockIngestDocuments,
  removeSource: mockRemoveSource,
}));

import { computeContentHash, hasContentChanged, indexRepository } from '../indexer';

describe('computeContentHash', () => {
  it('returns a hex string', () => {
    const hash = computeContentHash('hello world');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same content produces same hash', () => {
    const h1 = computeContentHash('test content');
    const h2 = computeContentHash('test content');
    expect(h1).toBe(h2);
  });

  it('different content produces different hash', () => {
    const h1 = computeContentHash('content A');
    const h2 = computeContentHash('content B');
    expect(h1).not.toBe(h2);
  });
});

describe('hasContentChanged', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('returns true when no stored document found (new document)', async () => {
    mockPrismaClient.indexedDocument.findFirst.mockResolvedValue(null);

    const changed = await hasContentChanged('source-1', 'README.md', 'abc123');
    expect(changed).toBe(true);
  });

  it('returns false when stored hash matches (unchanged)', async () => {
    mockPrismaClient.indexedDocument.findFirst.mockResolvedValue({
      id: 'doc-1',
      sourceId: 'source-1',
      path: 'README.md',
      contentHash: 'abc123',
    });

    const changed = await hasContentChanged('source-1', 'README.md', 'abc123');
    expect(changed).toBe(false);
  });
});

describe('indexRepository', () => {
  beforeEach(() => {
    resetPrismaMocks();
    vi.clearAllMocks();
  });

  const mockRepoRecord = {
    id: 'repo-1',
    owner: 'edlight',
    name: 'academy',
    displayName: 'EdLight Academy',
    description: 'Educational platform',
    url: 'https://github.com/edlight/academy',
    branch: 'main',
    docsPath: null,
    isActive: true,
    syncStatus: 'not_indexed',
    lastSyncAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSource = {
    id: 'source-1',
    name: 'EdLight Academy',
    type: 'github_repo',
    url: 'https://github.com/edlight/academy',
    owner: 'edlight',
    repo: 'academy',
    branch: 'main',
    status: 'indexing',
    documentCount: 0,
    lastIndexedAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('returns failed result when repo not found', async () => {
    mockPrismaClient.repoRegistry.findUnique.mockResolvedValue(null);

    const result = await indexRepository('nonexistent-id');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('not found');
  });

  it('sets syncStatus to indexing at start, indexed on completion', async () => {
    mockPrismaClient.repoRegistry.findUnique.mockResolvedValue(mockRepoRecord);
    mockPrismaClient.repoRegistry.update.mockResolvedValue({ ...mockRepoRecord, syncStatus: 'indexed' });
    mockPrismaClient.indexedSource.upsert.mockResolvedValue(mockSource);
    mockPrismaClient.indexedDocument.findFirst.mockResolvedValue({ id: 'existing' }); // no change
    mockPrismaClient.indexedDocument.createMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.indexedDocument.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.indexedSource.update.mockResolvedValue(mockSource);

    mockFetchRepoContent.mockResolvedValue([
      { path: 'README.md', name: 'README.md', content: '# Academy', sha: 'abc', size: 100, url: 'https://...' },
    ]);
    mockIngestDocuments.mockResolvedValue({ totalChunks: 5, totalDocuments: 1 });
    mockRemoveSource.mockResolvedValue(undefined);

    const result = await indexRepository('repo-1');

    // Should have called update at least twice (indexing + indexed)
    const updateCalls = mockPrismaClient.repoRegistry.update.mock.calls;
    const statusValues = updateCalls.map((call) => call[0]?.data?.syncStatus);
    expect(statusValues).toContain('indexing');
    expect(statusValues).toContain('indexed');
    expect(result.status).toBe('completed');
  });

  it('skips unchanged documents (content hash match)', async () => {
    mockPrismaClient.repoRegistry.findUnique.mockResolvedValue(mockRepoRecord);
    mockPrismaClient.repoRegistry.update.mockResolvedValue(mockRepoRecord);
    mockPrismaClient.indexedSource.upsert.mockResolvedValue(mockSource);

    const content = '# README';
    const hash = computeContentHash(content);

    // Simulate: document already in DB with same hash
    mockPrismaClient.indexedDocument.findFirst.mockResolvedValue({
      id: 'existing-doc',
      sourceId: 'source-1',
      path: 'README.md',
      contentHash: hash,
    });

    mockFetchRepoContent.mockResolvedValue([
      { path: 'README.md', name: 'README.md', content, sha: 'abc', size: 100, url: 'https://...' },
    ]);
    mockIngestDocuments.mockResolvedValue({ totalChunks: 0, totalDocuments: 0 });
    mockRemoveSource.mockResolvedValue(undefined);

    const result = await indexRepository('repo-1');

    expect(result.documentsSkipped).toBe(1);
    expect(result.documentsProcessed).toBe(0);
    // Should NOT have ingested anything
    expect(mockIngestDocuments).not.toHaveBeenCalled();
    expect(mockRemoveSource).not.toHaveBeenCalled();
  });

  it('returns completed result with correct counts', async () => {
    mockPrismaClient.repoRegistry.findUnique.mockResolvedValue(mockRepoRecord);
    mockPrismaClient.repoRegistry.update.mockResolvedValue(mockRepoRecord);
    mockPrismaClient.indexedSource.upsert.mockResolvedValue(mockSource);
    mockPrismaClient.indexedDocument.findFirst.mockResolvedValue(null); // always changed
    mockPrismaClient.indexedDocument.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.indexedDocument.createMany.mockResolvedValue({ count: 2 });
    mockPrismaClient.indexedSource.update.mockResolvedValue(mockSource);

    mockFetchRepoContent.mockResolvedValue([
      { path: 'README.md', name: 'README.md', content: '# A', sha: 'a', size: 100, url: 'https://...' },
      { path: 'guide.md', name: 'guide.md', content: '# B', sha: 'b', size: 200, url: 'https://...' },
    ]);
    mockIngestDocuments.mockResolvedValue({ totalChunks: 10, totalDocuments: 2 });
    mockRemoveSource.mockResolvedValue(undefined);

    const result = await indexRepository('repo-1');

    expect(result.status).toBe('completed');
    expect(result.documentsProcessed).toBe(2);
    expect(result.documentsSkipped).toBe(0);
    expect(result.chunksCreated).toBe(10);
    expect(result.filesIndexed).toBe(2);
    expect(result.repoId).toBe('repo-1');
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it('returns failed result and sets syncStatus=error on fetch failure', async () => {
    mockPrismaClient.repoRegistry.findUnique.mockResolvedValue(mockRepoRecord);
    mockPrismaClient.repoRegistry.update.mockResolvedValue(mockRepoRecord);
    mockPrismaClient.indexedSource.upsert.mockResolvedValue(mockSource);

    mockFetchRepoContent.mockRejectedValue(new Error('GitHub API timeout'));

    const result = await indexRepository('repo-1');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('GitHub API timeout');

    const updateCalls = mockPrismaClient.repoRegistry.update.mock.calls;
    const statusValues = updateCalls.map((call) => call[0]?.data?.syncStatus);
    expect(statusValues).toContain('error');
  });
});
