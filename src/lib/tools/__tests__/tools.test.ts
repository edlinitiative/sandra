import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { mockPrismaClient, resetPrismaMocks } from '@/lib/__tests__/mocks/prisma';
import type { ToolContext } from '../types';

// Mock db before any imports
vi.mock('@/lib/db', () => ({
  db: mockPrismaClient as unknown as PrismaClient,
}));

// Mock retrieval module — use object so vi.fn() is defined at hoist time
vi.mock('@/lib/knowledge/retrieval', () => ({
  retrieveContext: vi.fn(),
}));

// Import tools after mocks are in place
import { searchKnowledgeBase } from '../search-knowledge';
import { lookupRepoInfo } from '../lookup-repo';
import { getEdLightInitiatives } from '../get-initiatives';
import { retrieveContext } from '@/lib/knowledge/retrieval';

const mockRetrieve = vi.mocked(retrieveContext);

const baseContext: ToolContext = {
  sessionId: 'sess_1',
  scopes: ['knowledge:read', 'repos:read'],
};

describe('searchKnowledgeBase tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct name and scopes', () => {
    expect(searchKnowledgeBase.name).toBe('searchKnowledgeBase');
    expect(searchKnowledgeBase.requiredScopes).toContain('knowledge:read');
  });

  it('returns empty results when vector store has no matches', async () => {
    mockRetrieve.mockResolvedValue([]);

    const result = await searchKnowledgeBase.handler({ query: 'test', topK: 5 }, baseContext);

    expect(result.success).toBe(true);
    expect((result.data as { totalResults: number }).totalResults).toBe(0);
  });

  it('returns formatted results from vector store', async () => {
    mockRetrieve.mockResolvedValue([
      {
        chunk: { content: 'EdLight is a coding platform', path: 'README.md', title: 'README', sourceId: 'src1', chunkIndex: 0, chunkTotal: 1, contentHash: 'abc' },
        score: 0.92,
      },
    ]);

    const result = await searchKnowledgeBase.handler({ query: 'EdLight', topK: 5 }, baseContext);

    expect(result.success).toBe(true);
    const data = result.data as { results: Array<{ content: string; score: number }> };
    expect(data.results).toHaveLength(1);
    expect(data.results[0]?.content).toBe('EdLight is a coding platform');
    expect(data.results[0]?.score).toBe(0.92);
  });

  it('passes retrieval filters through to retrieveContext', async () => {
    mockRetrieve.mockResolvedValue([]);

    await searchKnowledgeBase.handler({
      query: 'hello',
      topK: 3,
      platform: 'academy',
      contentType: 'course',
      preferPaths: ['docs/', 'courses/'],
    }, baseContext);

    expect(mockRetrieve).toHaveBeenCalledWith('hello', {
      topK: 3,
      filter: {
        platform: 'academy',
        repo: undefined,
        contentType: 'course',
        preferPaths: ['docs/', 'courses/'],
      },
    });
  });
});

describe('lookupRepoInfo tool', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('has correct name and scopes', () => {
    expect(lookupRepoInfo.name).toBe('lookupRepoInfo');
    expect(lookupRepoInfo.requiredScopes).toContain('repos:read');
  });

  it('returns all active repos when no repoName provided', async () => {
    mockPrismaClient.repoRegistry.findMany.mockResolvedValue([
      { id: 'r1', name: 'code', displayName: 'EdLight Code', description: 'Coding platform', url: 'https://github.com/edlinitiative/code', syncStatus: 'indexed', lastSyncAt: null },
    ]);

    const result = await lookupRepoInfo.handler({}, baseContext);

    expect(result.success).toBe(true);
    const data = result.data as { repos: Array<{ name: string }> };
    expect(data.repos).toHaveLength(1);
    expect(data.repos[0]?.name).toBe('code');
  });

  it('filters by repoName when provided', async () => {
    mockPrismaClient.repoRegistry.findMany.mockResolvedValue([
      { id: 'r1', name: 'code', displayName: 'EdLight Code', description: null, url: 'https://github.com', syncStatus: 'not_indexed', lastSyncAt: null },
      { id: 'r2', name: 'news', displayName: 'EdLight News', description: null, url: 'https://github.com', syncStatus: 'not_indexed', lastSyncAt: null },
    ]);

    const result = await lookupRepoInfo.handler({ repoName: 'code' }, baseContext);

    expect(result.success).toBe(true);
    const data = result.data as { repos: Array<{ name: string }> };
    expect(data.repos).toHaveLength(1);
    expect(data.repos[0]?.name).toBe('code');
  });

  it('returns empty repos array when no match found', async () => {
    mockPrismaClient.repoRegistry.findMany.mockResolvedValue([]);

    const result = await lookupRepoInfo.handler({ repoName: 'nonexistent' }, baseContext);
    expect(result.success).toBe(true);
    const data = result.data as { repos: unknown[] };
    expect(data.repos).toHaveLength(0);
  });
});

describe('getEdLightInitiatives tool', () => {
  it('has correct name and scopes', () => {
    expect(getEdLightInitiatives.name).toBe('getEdLightInitiatives');
    expect(getEdLightInitiatives.requiredScopes).toContain('repos:read');
  });

  it('returns all 6 initiatives when no category filter', async () => {
    const result = await getEdLightInitiatives.handler({}, baseContext);

    expect(result.success).toBe(true);
    const data = result.data as { initiatives: Array<{ name: string }> };
    expect(data.initiatives).toHaveLength(6);
  });

  it('filters by category: coding', async () => {
    const result = await getEdLightInitiatives.handler({ category: 'coding' }, baseContext);

    const data = result.data as { initiatives: Array<{ name: string; category: string }> };
    expect(data.initiatives).toHaveLength(1);
    expect(data.initiatives[0]?.name).toBe('EdLight Code');
  });

  it('filters by category: news', async () => {
    const result = await getEdLightInitiatives.handler({ category: 'news' }, baseContext);
    const data = result.data as { initiatives: Array<{ name: string }> };
    expect(data.initiatives).toHaveLength(1);
    expect(data.initiatives[0]?.name).toBe('EdLight News');
  });

  it('returns initiative data with descriptions', async () => {
    const result = await getEdLightInitiatives.handler({}, baseContext);
    const data = result.data as { initiatives: Array<{ description: string }> };
    for (const initiative of data.initiatives) {
      expect(initiative.description).toBeTruthy();
    }
  });

  it('includes totalPlatforms in response', async () => {
    const result = await getEdLightInitiatives.handler({}, baseContext);
    const data = result.data as { totalPlatforms: number };
    expect(data.totalPlatforms).toBe(7);
  });
});
