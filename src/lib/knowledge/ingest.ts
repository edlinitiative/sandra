import type { RawDocument, EmbeddedChunk } from './types';
import { chunkDocument } from './chunker';
import { embedChunks } from './embeddings';
import { getVectorStore } from './vector-store';
import { createLogger } from '@/lib/utils';

const log = createLogger('knowledge:ingest');

/**
 * Ingest raw documents into the knowledge base.
 * Chunks → embeds → stores in vector store.
 */
export async function ingestDocuments(
  documents: RawDocument[],
  options?: { chunkSize?: number; chunkOverlap?: number },
): Promise<{ totalChunks: number; totalDocuments: number }> {
  log.info(`Ingesting ${documents.length} documents`);

  // 1. Chunk all documents
  const allChunks = documents.flatMap((doc) => chunkDocument(doc, options));
  log.info(`Chunked into ${allChunks.length} chunks`);

  if (allChunks.length === 0) {
    return { totalChunks: 0, totalDocuments: documents.length };
  }

  // 2. Generate embeddings
  const embedded: EmbeddedChunk[] = await embedChunks(allChunks);

  // 3. Store in vector store
  const store = getVectorStore();
  await store.upsert(embedded);

  log.info(`Ingestion complete: ${embedded.length} chunks stored`);
  return { totalChunks: embedded.length, totalDocuments: documents.length };
}

/**
 * Remove all indexed content for a source.
 */
export async function removeSource(sourceId: string): Promise<void> {
  const store = getVectorStore();
  await store.deleteBySource(sourceId);
  log.info(`Removed all content for source: ${sourceId}`);
}
