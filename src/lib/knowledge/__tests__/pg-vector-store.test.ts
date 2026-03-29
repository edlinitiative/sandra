import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { mockPrismaClient, resetPrismaMocks } from '@/lib/__tests__/mocks/prisma';

// Mock db client
vi.mock('@/lib/db/client', () => ({
  db: mockPrismaClient as unknown as PrismaClient,
}));

import { PgVectorStore } from '../pg-vector-store';
import type { EmbeddedChunk } from '../types';

function makeChunk(
  content: string,
  embedding: number[],
  sourceId = 'src_1',
  overrides: Partial<EmbeddedChunk> = {},
): EmbeddedChunk {
  return {
    sourceId,
    title: 'Test',
    path: 'README.md',
    content,
    chunkIndex: 0,
    chunkTotal: 1,
    contentHash: content.slice(0, 8).replace(/\s/g, '_'),
    embedding,
    metadata: {},
    ...overrides,
  };
}

describe('PgVectorStore', () => {
  let store: PgVectorStore;

  beforeEach(() => {
    resetPrismaMocks();
    store = new PgVectorStore();
  });

  describe('upsert', () => {
    it('does nothing for empty array', async () => {
      await store.upsert([]);
      expect(mockPrismaClient.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('inserts chunks via raw SQL with embedding as vector cast', async () => {
      const chunks = [makeChunk('doc 1', [1, 0, 0])];
      await store.upsert(chunks);

      // Should call delete (dedup) + insert for each chunk
      expect(mockPrismaClient.$executeRawUnsafe).toHaveBeenCalledTimes(2);

      // First call: DELETE for dedup
      const deleteCall = mockPrismaClient.$executeRawUnsafe.mock.calls[0]!;
      expect(deleteCall[0]).toContain('DELETE FROM "IndexedDocument"');
      expect(deleteCall[1]).toBe('src_1'); // sourceId
      expect(deleteCall[2]).toBe('doc_1'); // contentHash

      // Second call: INSERT with vector cast
      const insertCall = mockPrismaClient.$executeRawUnsafe.mock.calls[1]!;
      expect(insertCall[0]).toContain('INSERT INTO "IndexedDocument"');
      expect(insertCall[0]).toContain('$8::vector');
      expect(insertCall[1]).toBe('src_1'); // sourceId
      expect(insertCall[8]).toBe('[1,0,0]'); // embedding as vector string
    });

    it('handles multiple chunks', async () => {
      const chunks = [
        makeChunk('doc 1', [1, 0, 0]),
        makeChunk('doc 2', [0, 1, 0], 'src_2'),
      ];
      await store.upsert(chunks);

      // 2 chunks × 2 calls each (delete + insert)
      expect(mockPrismaClient.$executeRawUnsafe).toHaveBeenCalledTimes(4);
    });
  });

  describe('search', () => {
    it('returns empty array when no results', async () => {
      const queryVec = new Array(1536).fill(0);
      queryVec[0] = 1;

      const results = await store.search(queryVec, 5);
      expect(results).toEqual([]);
    });

    it('returns empty array for wrong dimension query', async () => {
      const results = await store.search([1, 0], 5); // 2-dim instead of 1536
      expect(results).toEqual([]);
      expect(mockPrismaClient.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('converts cosine distance to similarity score', async () => {
      const queryVec = new Array(1536).fill(0);
      queryVec[0] = 1;

      mockPrismaClient.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'doc-1',
          sourceId: 'src_1',
          title: 'Test',
          path: 'README.md',
          content: 'doc content',
          chunkIndex: 0,
          chunkTotal: 1,
          contentHash: 'abc',
          metadata: { repo: 'src_1', platform: 'code' },
          distance: 0.1, // cosine distance → similarity = 0.9
        },
      ]);

      const results = await store.search(queryVec, 5);
      expect(results).toHaveLength(1);
      // base similarity = 1 - 0.1 = 0.9, pathPriority boost for README.md = 6 × 0.025 = 0.15
      expect(results[0]!.score).toBeCloseTo(1.05, 1);
      expect(results[0]!.chunk.content).toBe('doc content');
      expect(results[0]!.chunk.sourceId).toBe('src_1');
    });

    it('passes sourceId filter to SQL WHERE clause', async () => {
      const queryVec = new Array(1536).fill(0);
      queryVec[0] = 1;

      await store.search(queryVec, 5, { sourceId: 'edlinitiative/code' });

      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      const sql = mockPrismaClient.$queryRawUnsafe.mock.calls[0]![0] as string;
      expect(sql).toContain('"sourceId"');
      // sourceId filter should be passed as a parameter
      const params = mockPrismaClient.$queryRawUnsafe.mock.calls[0]!;
      expect(params).toContain('edlinitiative/code');
    });

    it('filters by repo metadata (JS-side)', async () => {
      const queryVec = new Array(1536).fill(0);
      queryVec[0] = 1;

      mockPrismaClient.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'doc-1',
          sourceId: 'src_1',
          title: 'Academy',
          path: 'courses/math.md',
          content: 'Math course',
          chunkIndex: 0,
          chunkTotal: 1,
          contentHash: 'abc',
          metadata: { repo: 'edlinitiative/EdLight-Academy' },
          distance: 0.2,
        },
        {
          id: 'doc-2',
          sourceId: 'src_2',
          title: 'Code',
          path: 'docs/api.md',
          content: 'API docs',
          chunkIndex: 0,
          chunkTotal: 1,
          contentHash: 'def',
          metadata: { repo: 'edlinitiative/code' },
          distance: 0.3,
        },
      ]);

      const results = await store.search(queryVec, 5, {
        repo: 'edlinitiative/EdLight-Academy',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.chunk.content).toBe('Math course');
    });

    it('applies path boost for preferred paths', async () => {
      const queryVec = new Array(1536).fill(0);
      queryVec[0] = 1;

      mockPrismaClient.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'doc-1',
          sourceId: 'src',
          title: 'Generic',
          path: 'notes/generic.txt',
          content: 'generic',
          chunkIndex: 0,
          chunkTotal: 1,
          contentHash: 'a',
          metadata: { pathPriority: 1 },
          distance: 0.2,
        },
        {
          id: 'doc-2',
          sourceId: 'src',
          title: 'Preferred',
          path: 'docs/courses/python.md',
          content: 'python course',
          chunkIndex: 0,
          chunkTotal: 1,
          contentHash: 'b',
          metadata: { pathPriority: 6 },
          distance: 0.2, // same base distance
        },
      ]);

      const results = await store.search(queryVec, 5, {
        preferPaths: ['docs/', 'courses/'],
      });

      // "Preferred" should rank higher due to preferPath boost (+0.18) and pathPriority boost (6×0.025 = 0.15)
      expect(results[0]!.chunk.content).toBe('python course');
      expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
    });
  });

  describe('deleteBySource', () => {
    it('deletes all chunks matching sourceId', async () => {
      mockPrismaClient.$executeRawUnsafe.mockResolvedValue(5);

      await store.deleteBySource('edlinitiative/code');

      expect(mockPrismaClient.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM "IndexedDocument"'),
        'edlinitiative/code',
      );
    });
  });

  describe('count', () => {
    it('returns total count when no sourceId', async () => {
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue([{ count: BigInt(42) }]);

      const result = await store.count();
      expect(result).toBe(42);
    });

    it('returns filtered count for sourceId', async () => {
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue([{ count: BigInt(10) }]);

      const result = await store.count('edlinitiative/code');
      expect(result).toBe(10);

      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      const sql = mockPrismaClient.$queryRawUnsafe.mock.calls[0]![0] as string;
      expect(sql).toContain('"sourceId"');
      expect(sql).toContain('COUNT');
      const params = mockPrismaClient.$queryRawUnsafe.mock.calls[0]!;
      expect(params).toContain('edlinitiative/code');
    });

    it('returns 0 when no results', async () => {
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue([{ count: BigInt(0) }]);

      const result = await store.count();
      expect(result).toBe(0);
    });
  });

  describe('isReady', () => {
    it('returns true when pgvector extension exists', async () => {
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue([{ extname: 'vector' }]);

      const ready = await store.isReady();
      expect(ready).toBe(true);
    });

    it('returns false when query fails', async () => {
      mockPrismaClient.$queryRawUnsafe.mockRejectedValue(new Error('extension not found'));

      const ready = await store.isReady();
      expect(ready).toBe(false);
    });
  });
});
