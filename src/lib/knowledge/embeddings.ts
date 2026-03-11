import { getAIProvider } from '@/lib/ai';
import type { DocumentChunk, EmbeddedChunk } from './types';
import { createLogger } from '@/lib/utils';

const log = createLogger('knowledge:embeddings');

/**
 * Generate embeddings for document chunks using the configured AI provider.
 */
export async function embedChunks(
  chunks: DocumentChunk[],
  batchSize = 20,
): Promise<EmbeddedChunk[]> {
  if (chunks.length === 0) return [];

  const provider = getAIProvider();
  const results: EmbeddedChunk[] = [];

  // Process in batches to respect API rate limits
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.content);

    log.debug(`Embedding batch ${i / batchSize + 1}, size=${batch.length}`);

    const response = await provider.generateEmbeddings({ input: texts });

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]!;
      const embedding = response.embeddings[j];
      if (!embedding) {
        log.warn(`Missing embedding for chunk ${i + j}`);
        continue;
      }
      results.push({ ...chunk, embedding });
    }
  }

  log.info(`Embedded ${results.length} chunks`);
  return results;
}

/**
 * Generate a single embedding for a query string.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const provider = getAIProvider();
  const response = await provider.generateEmbeddings({ input: query });
  const embedding = response.embeddings[0];
  if (!embedding) throw new Error('Failed to generate query embedding');
  return embedding;
}
