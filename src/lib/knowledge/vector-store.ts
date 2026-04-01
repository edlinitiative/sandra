import type {
  VectorStore,
  EmbeddedChunk,
  SearchResult,
  DocumentChunk,
  KnowledgeSearchFilter,
} from './types';
import { DEFAULT_TOP_K } from '@/lib/config';
import { env } from '@/lib/config';
import { createLogger } from '@/lib/utils';
import {
  computePathPriority,
  inferContentTypeFromChunk,
  inferPlatformFromChunk,
  metadataNumber,
  metadataString,
} from './platform-metadata';
import { PgVectorStore } from './pg-vector-store';

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

  async search(query: number[], topK?: number, filter?: KnowledgeSearchFilter): Promise<SearchResult[]> {
    const k = topK ?? DEFAULT_TOP_K;

    let candidates = this.entries;
    candidates = candidates.filter((entry) => matchesFilter(entry, filter));

    const scored = candidates.map((entry) => ({
      chunk: stripEmbedding(entry),
      score: boostedSimilarity(query, entry, filter),
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

function matchesFilter(entry: EmbeddedChunk, filter?: KnowledgeSearchFilter): boolean {
  if (!filter) return true;

  if (filter.sourceId && entry.sourceId !== filter.sourceId) {
    return false;
  }

  const metadata = entry.metadata;
  const repo = metadataString(metadata, 'repo') ?? entry.sourceId;
  if (filter.repo && repo.toLowerCase() !== filter.repo.toLowerCase()) {
    return false;
  }

  const platform = inferPlatformFromChunk({
    sourceId: entry.sourceId,
    title: entry.title,
    path: entry.path,
    metadata,
  });
  if (filter.platform && platform !== filter.platform) {
    return false;
  }

  const contentType = inferContentTypeFromChunk({
    path: entry.path,
    content: entry.content,
    metadata,
    platform,
  });

  if (filter.contentType) {
    const expected = Array.isArray(filter.contentType)
      ? filter.contentType
      : [filter.contentType];
    if (!expected.includes(contentType)) {
      return false;
    }
  }

  return true;
}

function boostedSimilarity(
  query: number[],
  entry: EmbeddedChunk,
  filter?: KnowledgeSearchFilter,
): number {
  const similarity = cosineSimilarity(query, entry.embedding);
  const metadata = entry.metadata;
  const preferredPaths = filter?.preferPaths ?? [];
  const path = (entry.path ?? '').toLowerCase();
  const preferPathBoost = preferredPaths.some((preferredPath) =>
    path.includes(preferredPath.toLowerCase()),
  )
    ? 0.18
    : 0;
  const pathPriority =
    metadataNumber(metadata, 'pathPriority') ??
    computePathPriority(entry.path, inferContentTypeFromChunk({
      path: entry.path,
      content: entry.content,
      metadata,
      platform: inferPlatformFromChunk({
        sourceId: entry.sourceId,
        title: entry.title,
        path: entry.path,
        metadata,
      }),
    }));
  const pathPriorityBoost = pathPriority * 0.025;

  return similarity + preferPathBoost + pathPriorityBoost;
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

/**
 * Get the vector store singleton.
 * Prefers PgVectorStore (persistent) when DATABASE_URL is configured.
 * Falls back to InMemoryVectorStore for testing or when DB is unavailable.
 */
export function getVectorStore(): VectorStore {
  if (!vectorStore) {
    const usePostgres =
      env.VECTOR_STORE_PROVIDER === 'postgres' ||
      // Safety fallback: if provider is still 'memory' but we're in production with a DB, use pgvector
      (env.VECTOR_STORE_PROVIDER === 'memory' && !!process.env.DATABASE_URL && process.env.NODE_ENV === 'production');

    if (usePostgres) {
      log.info('Initializing PgVectorStore (pgvector-backed, persistent)');
      vectorStore = new PgVectorStore();
    } else {
      log.info('Initializing InMemoryVectorStore (volatile)');
      vectorStore = new InMemoryVectorStore();
    }
  }
  return vectorStore;
}

export function setVectorStore(store: VectorStore): void {
  vectorStore = store;
}

/**
 * Reset the singleton (used in tests).
 */
export function resetVectorStore(): void {
  vectorStore = null;
}
