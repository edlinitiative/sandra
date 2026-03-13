import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../embeddings', () => ({
  embedQuery: vi.fn(),
  embedChunks: vi.fn(),
}));

vi.mock('../vector-store', () => ({
  getVectorStore: vi.fn(),
  setVectorStore: vi.fn(),
}));

import { retrieveContext } from '../retrieval';
import { embedQuery } from '../embeddings';
import { getVectorStore } from '../vector-store';

const mockEmbedQuery = embedQuery as ReturnType<typeof vi.fn>;
const mockGetVectorStore = getVectorStore as ReturnType<typeof vi.fn>;

describe('retrieveContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when vector store has no results', async () => {
    mockEmbedQuery.mockResolvedValue([1, 0, 0]);
    mockGetVectorStore.mockReturnValue({
      search: vi.fn().mockResolvedValue([]),
    });

    const results = await retrieveContext('test query');
    expect(results).toEqual([]);
  });

  it('embeds the query before searching', async () => {
    mockEmbedQuery.mockResolvedValue([0.5, 0.5]);
    mockGetVectorStore.mockReturnValue({
      search: vi.fn().mockResolvedValue([]),
    });

    await retrieveContext('hello world');

    expect(mockEmbedQuery).toHaveBeenCalledWith('hello world');
  });

  it('passes topK to vector store search', async () => {
    const mockSearch = vi.fn().mockResolvedValue([]);
    mockEmbedQuery.mockResolvedValue([1, 0]);
    mockGetVectorStore.mockReturnValue({ search: mockSearch });

    await retrieveContext('query', { topK: 10 });

    expect(mockSearch).toHaveBeenCalledWith(expect.any(Array), 10, undefined);
  });

  it('returns filtered results above minScore threshold', async () => {
    mockEmbedQuery.mockResolvedValue([1, 0]);
    mockGetVectorStore.mockReturnValue({
      search: vi.fn().mockResolvedValue([
        { chunk: { content: 'high score', path: 'a.md', title: 'A' }, score: 0.9 },
        { chunk: { content: 'low score', path: 'b.md', title: 'B' }, score: 0.2 },
      ]),
    });

    const results = await retrieveContext('query', { minScore: 0.5 });
    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.content).toBe('high score');
  });

  it('returns empty array if embedding fails', async () => {
    mockEmbedQuery.mockRejectedValue(new Error('API error'));

    const results = await retrieveContext('query');
    expect(results).toEqual([]);
  });
});
