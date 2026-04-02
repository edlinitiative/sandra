import { describe, it, expect } from 'vitest';
import { rerankResults } from '@/lib/knowledge/retrieval';
import type { SearchResult } from '@/lib/knowledge/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResult(platform: string, score: number, content = 'some content'): SearchResult {
  return {
    score,
    chunk: {
      sourceId: 'src-1',
      content,
      chunkIndex: 0,
      chunkTotal: 1,
      contentHash: 'abc',
      metadata: { platform },
    },
  };
}

// ─── No platform signal ───────────────────────────────────────────────────────

describe('rerankResults — no platform keywords in query', () => {
  it('returns results unchanged when query has no platform keywords', () => {
    const results = [makeResult('academy', 0.8), makeResult('code', 0.7)];
    const reranked = rerankResults(results, 'what is the price?');
    expect(reranked).toHaveLength(2);
    expect(reranked[0]!.score).toBe(0.8);
    expect(reranked[1]!.score).toBe(0.7);
  });

  it('returns empty array unchanged', () => {
    expect(rerankResults([], 'hello')).toHaveLength(0);
  });
});

// ─── Platform boost applied ───────────────────────────────────────────────────

describe('rerankResults — platform keyword detected in query', () => {
  it('boosts score +0.12 for matching platform chunk', () => {
    const results = [makeResult('academy', 0.7), makeResult('code', 0.7)];
    const reranked = rerankResults(results, 'I want to learn maths on academy');
    const academyItem = reranked.find(
      (r) => r.chunk.metadata?.platform === 'academy',
    )!;
    expect(academyItem.score).toBeCloseTo(0.82, 5);
  });

  it('does NOT boost non-matching platform chunks', () => {
    const results = [makeResult('code', 0.7), makeResult('news', 0.6)];
    const reranked = rerankResults(results, 'python coding tutorial');
    const codeItem = reranked.find((r) => r.chunk.metadata?.platform === 'code')!;
    const newsItem = reranked.find((r) => r.chunk.metadata?.platform === 'news')!;
    expect(codeItem.score).toBeCloseTo(0.82, 5);
    expect(newsItem.score).toBeCloseTo(0.6, 5);
  });

  it('caps boosted score at 1.0', () => {
    const results = [makeResult('academy', 0.95)];
    const reranked = rerankResults(results, 'maths lesson');
    expect(reranked[0]!.score).toBe(1.0);
  });

  it('re-sorts by boosted score descending', () => {
    // academy (0.6 → 0.72) should outrank news (0.65, not boosted)
    const results = [makeResult('news', 0.65), makeResult('academy', 0.6)];
    const reranked = rerankResults(results, 'academy maths course');
    expect(reranked[0]!.chunk.metadata?.platform).toBe('academy');
    expect(reranked[1]!.chunk.metadata?.platform).toBe('news');
  });
});

// ─── Specific platform keywords ────────────────────────────────────────────────

describe('rerankResults — keyword triggers', () => {
  it.each([
    ['coding', 'code'],
    ['sql', 'code'],
    ['python', 'code'],
    ['git', 'code'],
  ])('query with "%s" boosts "code" platform', (keyword, platform) => {
    const results = [makeResult(platform, 0.5)];
    const reranked = rerankResults(results, `learn ${keyword}`);
    expect(reranked[0]!.score).toBeGreaterThan(0.5);
  });

  it.each([
    ['scholarship', 'news'],
    ['announcement', 'news'],
    ['event', 'news'],
  ])('query with "%s" boosts "news" platform', (keyword, platform) => {
    const results = [makeResult(platform, 0.5)];
    const reranked = rerankResults(results, keyword);
    expect(reranked[0]!.score).toBeGreaterThan(0.5);
  });

  it.each([
    ['eslp', 'initiative'],
    ['nexus', 'initiative'],
    ['leadership', 'initiative'],
  ])('query with "%s" boosts "initiative" platform', (keyword, platform) => {
    const results = [makeResult(platform, 0.5)];
    const reranked = rerankResults(results, `tell me about ${keyword}`);
    expect(reranked[0]!.score).toBeGreaterThan(0.5);
  });
});

// ─── Chunks without metadata ──────────────────────────────────────────────────

describe('rerankResults — chunks without platform metadata', () => {
  it('does not crash on chunk with no metadata', () => {
    const noMeta: SearchResult = {
      score: 0.5,
      chunk: {
        sourceId: 'src-1',
        content: 'some content',
        chunkIndex: 0,
        chunkTotal: 1,
        contentHash: 'xyz',
      },
    };
    const results = [noMeta, makeResult('academy', 0.4)];
    const reranked = rerankResults(results, 'maths academy');
    expect(reranked).toHaveLength(2);
    // academy is boosted → should be first
    expect(reranked[0]!.chunk.metadata?.platform).toBe('academy');
    // no-metadata chunk keeps original score
    const noMetaResult = reranked.find((r) => !r.chunk.metadata?.platform)!;
    expect(noMetaResult.score).toBe(0.5);
  });
});
