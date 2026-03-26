import type {
  VectorStore,
  EmbeddedChunk,
  SearchResult,
  DocumentChunk,
  KnowledgeSearchFilter,
} from './types';
import { DEFAULT_TOP_K, EMBEDDING_DIMENSION } from '@/lib/config';
import { createLogger } from '@/lib/utils';
import {
  computePathPriority,
  inferContentTypeFromChunk,
  inferPlatformFromChunk,
  metadataNumber,
  metadataString,
} from './platform-metadata';
import { db } from '@/lib/db/client';

const log = createLogger('knowledge:pgvector');

/**
 * Row shape returned by pgvector similarity queries.
 * The `distance` field is the cosine distance (0 = identical, 2 = opposite).
 */
interface PgSearchRow {
  id: string;
  sourceId: string;
  title: string | null;
  path: string | null;
  content: string;
  chunkIndex: number;
  chunkTotal: number;
  contentHash: string | null;
  metadata: Record<string, unknown> | null;
  distance: number;
}

/**
 * PostgreSQL + pgvector-backed vector store.
 *
 * Stores embeddings as `vector(1536)` in the IndexedDocument table and
 * uses the `<=>` (cosine distance) operator with an HNSW index for
 * sub-millisecond approximate nearest-neighbour search.
 */
export class PgVectorStore implements VectorStore {
  /**
   * Upsert embedded chunks into the IndexedDocument table.
   * Uses INSERT ... ON CONFLICT (sourceId, contentHash) for dedup.
   */
  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    // Process in batches to avoid query-size limits
    const BATCH_SIZE = 100;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      await this.upsertBatch(batch);
    }

    log.info(`Upserted ${chunks.length} chunks into pgvector`);
  }

  private async upsertBatch(chunks: EmbeddedChunk[]): Promise<void> {
    // For each chunk, delete any existing row with same sourceId + contentHash, then insert
    for (const chunk of chunks) {
      const embeddingStr = `[${chunk.embedding.join(',')}]`;
      const meta = chunk.metadata ? JSON.stringify(chunk.metadata) : null;

      await db.$executeRawUnsafe(
        `DELETE FROM "IndexedDocument"
         WHERE "sourceId" = $1 AND "contentHash" = $2`,
        chunk.sourceId,
        chunk.contentHash,
      );

      await db.$executeRawUnsafe(
        `INSERT INTO "IndexedDocument"
           ("id", "sourceId", "title", "path", "content",
            "chunkIndex", "chunkTotal", "contentHash", "embedding", "metadata",
            "createdAt", "updatedAt")
         VALUES (
           gen_random_uuid()::text, $1, $2, $3, $4,
           $5, $6, $7, $8::vector, $9::jsonb,
           NOW(), NOW()
         )`,
        chunk.sourceId,
        chunk.title ?? null,
        chunk.path ?? null,
        chunk.content,
        chunk.chunkIndex,
        chunk.chunkTotal,
        chunk.contentHash,
        embeddingStr,
        meta,
      );
    }
  }

  /**
   * Search for similar chunks using pgvector cosine distance.
   * Applies optional metadata filters (sourceId, repo, platform, contentType)
   * then applies JS-side boosting (preferPaths, pathPriority) identical to
   * InMemoryVectorStore for result-parity.
   */
  async search(
    query: number[],
    topK?: number,
    filter?: KnowledgeSearchFilter,
  ): Promise<SearchResult[]> {
    const k = topK ?? DEFAULT_TOP_K;
    // Fetch more candidates than needed so post-filter + re-ranking has room
    const fetchLimit = Math.max(k * 4, 40);

    if (query.length !== EMBEDDING_DIMENSION) {
      log.warn(`Query vector dimension mismatch: got ${query.length}, expected ${EMBEDDING_DIMENSION}`);
      return [];
    }

    const queryVec = `[${query.join(',')}]`;

    // Build WHERE clause from filter
    const conditions: string[] = ['"embedding" IS NOT NULL'];
    const params: unknown[] = [queryVec, fetchLimit];
    let paramIdx = 3; // $1=queryVec, $2=fetchLimit

    if (filter?.sourceId) {
      conditions.push(`"sourceId" = $${paramIdx}`);
      params.push(filter.sourceId);
      paramIdx++;
    }

    const sql = `
      SELECT
        "id", "sourceId", "title", "path", "content",
        "chunkIndex", "chunkTotal", "contentHash", "metadata",
        ("embedding" <=> $1::vector) AS distance
      FROM "IndexedDocument"
      WHERE ${conditions.join(' AND ')}
      ORDER BY "embedding" <=> $1::vector
      LIMIT $2
    `;

    const rows: PgSearchRow[] = await db.$queryRawUnsafe(sql, ...params);

    // Convert cosine distance to similarity: similarity = 1 - distance
    // Then apply the same boosting logic as InMemoryVectorStore
    const results: SearchResult[] = rows
      .filter((row) => matchesMetadataFilter(row, filter))
      .map((row) => {
        const chunk = rowToChunk(row);
        const baseSimilarity = 1 - Number(row.distance);
        const boost = computeBoost(chunk, filter);
        return {
          chunk,
          score: baseSimilarity + boost,
        };
      });

    // Re-sort after boosting and take topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * Delete all chunks for a given source (sourceId is the repo full name).
   */
  async deleteBySource(sourceId: string): Promise<void> {
    // Delete from the linked IndexedSource → IndexedDocument cascade won't work here
    // because sourceId in the vector store is the human-readable repo name (e.g. "edlinitiative/code"),
    // not the IndexedSource cuid. We delete by matching the sourceId column directly.
    const result = await db.$executeRawUnsafe(
      `DELETE FROM "IndexedDocument" WHERE "sourceId" = $1`,
      sourceId,
    );
    log.info(`Deleted chunks for source ${sourceId}: ${result} removed`);
  }

  /**
   * Count stored chunks, optionally filtered by sourceId.
   */
  async count(sourceId?: string): Promise<number> {
    let result: Array<{ count: bigint }>;
    if (sourceId) {
      result = await db.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS count FROM "IndexedDocument" WHERE "sourceId" = $1 AND "embedding" IS NOT NULL`,
        sourceId,
      );
    } else {
      result = await db.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS count FROM "IndexedDocument" WHERE "embedding" IS NOT NULL`,
      );
    }
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Health check — verify that the pgvector extension and table are available.
   */
  async isReady(): Promise<boolean> {
    try {
      await db.$queryRawUnsafe(
        `SELECT 1 FROM pg_extension WHERE extname = 'vector'`,
      );
      return true;
    } catch {
      return false;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function rowToChunk(row: PgSearchRow): DocumentChunk {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    sourceId: row.sourceId,
    title: row.title ?? undefined,
    path: row.path ?? undefined,
    content: row.content,
    chunkIndex: row.chunkIndex,
    chunkTotal: row.chunkTotal,
    contentHash: row.contentHash ?? '',
    metadata,
  };
}

/**
 * JS-side metadata filter — mirrors InMemoryVectorStore.matchesFilter.
 * Applied after the initial pgvector ANN search to handle repo/platform/contentType
 * which are stored inside the JSONB metadata column.
 */
function matchesMetadataFilter(row: PgSearchRow, filter?: KnowledgeSearchFilter): boolean {
  if (!filter) return true;
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;

  // repo filter
  if (filter.repo) {
    const repo = metadataString(metadata, 'repo') ?? row.sourceId;
    if (repo.toLowerCase() !== filter.repo.toLowerCase()) return false;
  }

  // platform filter
  if (filter.platform) {
    const platform = inferPlatformFromChunk({
      sourceId: row.sourceId,
      title: row.title ?? undefined,
      path: row.path ?? undefined,
      metadata,
    });
    if (platform !== filter.platform) return false;
  }

  // contentType filter
  if (filter.contentType) {
    const platform = inferPlatformFromChunk({
      sourceId: row.sourceId,
      title: row.title ?? undefined,
      path: row.path ?? undefined,
      metadata,
    });
    const contentType = inferContentTypeFromChunk({
      path: row.path ?? undefined,
      content: row.content,
      metadata,
      platform,
    });
    const expected = Array.isArray(filter.contentType)
      ? filter.contentType
      : [filter.contentType];
    if (!expected.includes(contentType)) return false;
  }

  return true;
}

/**
 * Compute boost identical to InMemoryVectorStore (preferPaths + pathPriority).
 */
function computeBoost(chunk: DocumentChunk, filter?: KnowledgeSearchFilter): number {
  const preferredPaths = filter?.preferPaths ?? [];
  const path = (chunk.path ?? '').toLowerCase();

  const preferPathBoost = preferredPaths.some((p) =>
    path.includes(p.toLowerCase()),
  )
    ? 0.18
    : 0;

  const metadata = chunk.metadata;
  const platform = inferPlatformFromChunk({
    sourceId: chunk.sourceId,
    title: chunk.title,
    path: chunk.path,
    metadata,
  });
  const contentType = inferContentTypeFromChunk({
    path: chunk.path,
    content: chunk.content,
    metadata,
    platform,
  });

  const pathPriority =
    metadataNumber(metadata, 'pathPriority') ??
    computePathPriority(chunk.path, contentType);
  const pathPriorityBoost = pathPriority * 0.025;

  return preferPathBoost + pathPriorityBoost;
}
