import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVectorStore } from '../vector-store';
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

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;

  beforeEach(() => {
    store = new InMemoryVectorStore();
  });

  it('starts empty', async () => {
    expect(await store.count()).toBe(0);
  });

  it('upserts chunks and count increases', async () => {
    await store.upsert([makeChunk('doc 1', [1, 0, 0]), makeChunk('doc 2', [0, 1, 0])]);
    expect(await store.count()).toBe(2);
  });

  it('deduplicates by sourceId + contentHash', async () => {
    const chunk = makeChunk('doc 1', [1, 0, 0]);
    await store.upsert([chunk]);
    await store.upsert([{ ...chunk, embedding: [0.9, 0.1, 0] }]); // same hash, different embedding
    expect(await store.count()).toBe(1);
  });

  it('search returns results sorted by similarity descending', async () => {
    await store.upsert([
      makeChunk('most similar', [1, 0, 0], 'src_1', { path: 'plain.txt', metadata: { pathPriority: 0 } }),
      makeChunk('less similar', [0, 1, 0], 'src_1', { path: 'plain.txt', metadata: { pathPriority: 0 } }),
      makeChunk('not similar', [0, 0, 1], 'src_1', { path: 'plain.txt', metadata: { pathPriority: 0 } }),
    ]);

    const results = await store.search([1, 0, 0], 3);

    expect(results).toHaveLength(3);
    expect(results[0]?.chunk.content).toBe('most similar');
    expect(results[0]?.score).toBeCloseTo(1.0);
    expect(results[1]?.score).toBeLessThan(results[0]!.score);
  });

  it('cosine similarity: [1,0,0] most similar to [1,0,0], less to [0,1,0]', async () => {
    await store.upsert([
      makeChunk('a', [1, 0, 0], 'src_1', { path: 'plain.txt', metadata: { pathPriority: 0 } }),
      makeChunk('b', [0, 1, 0], 'src_1', { path: 'plain.txt', metadata: { pathPriority: 0 } }),
    ]);

    const results = await store.search([1, 0, 0], 2);
    expect(results[0]?.chunk.content).toBe('a');
    expect(results[0]?.score).toBeCloseTo(1.0);
    expect(results[1]?.score).toBeCloseTo(0.0);
  });

  it('search returns at most topK results', async () => {
    await store.upsert([
      makeChunk('a', [1, 0, 0]),
      makeChunk('b', [0.9, 0.1, 0]),
      makeChunk('c', [0.5, 0.5, 0]),
      makeChunk('d', [0, 1, 0]),
      makeChunk('e', [0, 0, 1]),
    ]);

    const results = await store.search([1, 0, 0], 2);
    expect(results).toHaveLength(2);
  });

  it('search returns empty when store is empty', async () => {
    const results = await store.search([1, 0, 0], 5);
    expect(results).toEqual([]);
  });

  it('deleteBySource removes chunks for that source', async () => {
    await store.upsert([makeChunk('doc1', [1, 0, 0], 'src_1')]);
    await store.upsert([makeChunk('doc2', [0, 1, 0], 'src_2')]);

    await store.deleteBySource('src_1');

    expect(await store.count()).toBe(1);
    expect(await store.count('src_1')).toBe(0);
    expect(await store.count('src_2')).toBe(1);
  });

  it('count with sourceId filters by source', async () => {
    await store.upsert([makeChunk('a', [1, 0, 0], 'src_1')]);
    await store.upsert([makeChunk('b', [0, 1, 0], 'src_2')]);

    expect(await store.count('src_1')).toBe(1);
    expect(await store.count('src_2')).toBe(1);
    expect(await store.count()).toBe(2);
  });

  it('isReady() returns true', async () => {
    expect(await store.isReady()).toBe(true);
  });

  it('filters search results by repo, platform, and content type metadata', async () => {
    await store.upsert([
      makeChunk('Academy course', [1, 0, 0], 'academy-src', {
        path: 'courses/math.md',
        metadata: {
          repo: 'edlinitiative/EdLight-Academy',
          platform: 'academy',
          contentType: 'course',
        },
      }),
      makeChunk('Initiative program', [1, 0, 0], 'initiative-src', {
        path: 'programs/leadership.md',
        metadata: {
          repo: 'edlinitiative/EdLight-Initiative',
          platform: 'initiative',
          contentType: 'program',
        },
      }),
    ]);

    const results = await store.search([1, 0, 0], 5, {
      repo: 'edlinitiative/EdLight-Academy',
      platform: 'academy',
      contentType: 'course',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.content).toBe('Academy course');
  });

  it('boosts preferred paths so course/docs matches outrank generic matches', async () => {
    await store.upsert([
      makeChunk('Generic overview', [1, 0, 0], 'repo', {
        path: 'notes/overview.txt',
        metadata: {
          repo: 'edlinitiative/EdLight-Code',
          platform: 'code',
          contentType: 'general',
          pathPriority: 1,
        },
      }),
      makeChunk('Course documentation', [1, 0, 0], 'repo', {
        path: 'docs/courses/python.md',
        metadata: {
          repo: 'edlinitiative/EdLight-Code',
          platform: 'code',
          contentType: 'course',
          pathPriority: 6,
        },
      }),
    ]);

    const results = await store.search([1, 0, 0], 2, {
      preferPaths: ['docs/', 'courses/'],
    });

    expect(results[0]?.chunk.content).toBe('Course documentation');
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });
});
