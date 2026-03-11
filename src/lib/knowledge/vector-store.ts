import type { VectorStore, EmbeddedChunk, SearchResult, DocumentChunk } from './types';
import { DEFAULT_TOP_K } from '@/lib/config';
import { createLogger } from '@/lib/utils';

const log = createLogger('knowledge:vectorstore');

/**
 * In-memory vector store implementation.
 * Uses brute-force cosine similarity — fine for development and small datasets.
 * Replace with Pinecone, Qdrant, or pgvector for production.
 */
export class InMemoryVectorStore implements VectorStore {
  private entries: EmbeddedChunk[] = [];

  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    for (const chunk of chunks) {
      // Deduplicate by content hash
      const existing = this.entries.findIndex(
        (e) => e.sourceId === chunk.sourceId && e.contentHash === chunk.contentHash,
      );
      if (existing >= 0) {
        this.entries[existing] = chunk;
      } else {
        this.entries.push(chunk);
      }
    }
    log.info(`Upserted ${chunks.length} chunks, total=${this.entries.length}`);
  }

  async search(query: number[], topK?: number, filter?: Record<string, unknown>): Promise<SearchResult[]> {
    const k = topK ?? DEFAULT_TOP_K;

    let candidates = this.entries;
    if (filter?.sourceId) {
      candidates = candidates.filter((e) => e.sourceId === filter.sourceId);
    }

    const scored = candidates.map((entry) => ({
      chunk: stripEmbedding(entry),
      score: cosineSimilarity(query, entry.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  async deleteBySource(sourceId: string): Promise<void> {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.sourceId !== sourceId);
    log.info(`Deleted chunks for source ${sourceId}: ${before - this.entries.length} removed`);
  }

  async count(sourceId?: string): Promise<number> {
    if (sourceId) {
      return this.entries.filter((e) => e.sourceId === sourceId).length;
    }
    return this.entries.length;
  }

  async isReady(): Promise<boolean> {
    return true;
  }
}

function stripEmbedding(chunk: EmbeddedChunk): DocumentChunk {
  const { embedding: _embedding, ...rest } = chunk;
  return rest;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

// Singleton
let vectorStore: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!vectorStore) {
    vectorStore = new InMemoryVectorStore();
  }
  return vectorStore;
}

export function setVectorStore(store: VectorStore): void {
  vectorStore = store;
}
