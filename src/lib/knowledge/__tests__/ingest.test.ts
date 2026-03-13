import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { RawDocument } from '../types';

vi.mock('../chunker', () => ({
  chunkDocument: vi.fn(),
}));

vi.mock('../embeddings', () => ({
  embedChunks: vi.fn(),
  embedQuery: vi.fn(),
}));

vi.mock('../vector-store', () => ({
  getVectorStore: vi.fn(),
  setVectorStore: vi.fn(),
}));

import { ingestDocuments, removeSource } from '../ingest';
import { chunkDocument } from '../chunker';
import { embedChunks } from '../embeddings';
import { getVectorStore } from '../vector-store';

const mockChunkDocument = chunkDocument as ReturnType<typeof vi.fn>;
const mockEmbedChunks = embedChunks as ReturnType<typeof vi.fn>;
const mockGetVectorStore = getVectorStore as ReturnType<typeof vi.fn>;

function makeDoc(overrides?: Partial<RawDocument>): RawDocument {
  return {
    sourceId: 'src_1',
    title: 'Test Doc',
    content: 'Test content',
    ...overrides,
  };
}

describe('ingestDocuments', () => {
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockDeleteBySource: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert = vi.fn().mockResolvedValue(undefined);
    mockDeleteBySource = vi.fn().mockResolvedValue(undefined);
    mockGetVectorStore.mockReturnValue({
      upsert: mockUpsert,
      deleteBySource: mockDeleteBySource,
    });
  });

  it('returns zero counts for empty document list', async () => {
    const result = await ingestDocuments([]);
    expect(result).toEqual({ totalChunks: 0, totalDocuments: 0 });
  });

  it('returns zero chunks when documents have no content', async () => {
    mockChunkDocument.mockReturnValue([]);
    mockEmbedChunks.mockResolvedValue([]);

    const result = await ingestDocuments([makeDoc({ content: '' })]);
    expect(result.totalChunks).toBe(0);
    expect(result.totalDocuments).toBe(1);
  });

  it('chunks → embeds → stores pipeline', async () => {
    const fakeChunks = [
      { sourceId: 'src_1', content: 'chunk 1', chunkIndex: 0, chunkTotal: 2, contentHash: 'abc', title: 'Test' },
      { sourceId: 'src_1', content: 'chunk 2', chunkIndex: 1, chunkTotal: 2, contentHash: 'def', title: 'Test' },
    ];
    const fakeEmbedded = fakeChunks.map((c) => ({ ...c, embedding: [1, 0, 0] }));

    mockChunkDocument.mockReturnValue(fakeChunks);
    mockEmbedChunks.mockResolvedValue(fakeEmbedded);

    const result = await ingestDocuments([makeDoc()]);

    expect(mockChunkDocument).toHaveBeenCalledWith(expect.objectContaining({ content: 'Test content' }), undefined);
    expect(mockEmbedChunks).toHaveBeenCalledWith(fakeChunks);
    expect(mockUpsert).toHaveBeenCalledWith(fakeEmbedded);
    expect(result).toEqual({ totalChunks: 2, totalDocuments: 1 });
  });

  it('processes multiple documents', async () => {
    const chunks1 = [{ sourceId: 'src_1', content: 'c1', chunkIndex: 0, chunkTotal: 1, contentHash: 'a', title: 'T1' }];
    const chunks2 = [{ sourceId: 'src_2', content: 'c2', chunkIndex: 0, chunkTotal: 1, contentHash: 'b', title: 'T2' }];
    const embedded = [...chunks1, ...chunks2].map((c) => ({ ...c, embedding: [1, 0] }));

    mockChunkDocument.mockReturnValueOnce(chunks1).mockReturnValueOnce(chunks2);
    mockEmbedChunks.mockResolvedValue(embedded);

    const result = await ingestDocuments([makeDoc({ sourceId: 'src_1' }), makeDoc({ sourceId: 'src_2' })]);

    expect(result.totalDocuments).toBe(2);
    expect(result.totalChunks).toBe(2);
  });
});

describe('removeSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockDeleteBySource = vi.fn().mockResolvedValue(undefined);
    mockGetVectorStore.mockReturnValue({ deleteBySource: mockDeleteBySource });
  });

  it('calls deleteBySource on the vector store', async () => {
    const mockStore = (mockGetVectorStore as unknown as () => { deleteBySource: ReturnType<typeof vi.fn> })();
    await removeSource('src_to_remove');
    expect(mockStore.deleteBySource).toHaveBeenCalledWith('src_to_remove');
  });
});
