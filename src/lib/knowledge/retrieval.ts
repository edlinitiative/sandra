import { getVectorStore } from './vector-store';
import { embedQuery } from './embeddings';
import type { SearchResult } from './types';
import { DEFAULT_TOP_K } from '@/lib/config';
import { createLogger } from '@/lib/utils';

const log = createLogger('knowledge:retrieval');

/**
 * High-level retrieval service.
 * Embeds a query and searches the vector store.
 */
export async function retrieveContext(
  query: string,
  options?: {
    topK?: number;
    sourceId?: string;
    minScore?: number;
  },
): Promise<SearchResult[]> {
  const topK = options?.topK ?? DEFAULT_TOP_K;
  const minScore = options?.minScore ?? 0.5;

  try {
    const queryEmbedding = await embedQuery(query);
    const store = getVectorStore();

    const filter = options?.sourceId ? { sourceId: options.sourceId } : undefined;
    const results = await store.search(queryEmbedding, topK, filter);

    // Filter by minimum score
    const filtered = results.filter((r) => r.score >= minScore);

    log.info(`Retrieved ${filtered.length} results for query`, {
      query: query.slice(0, 80),
      topK,
      minScore,
      totalResults: results.length,
      filteredResults: filtered.length,
    });

    return filtered;
  } catch (error) {
    log.error('Retrieval failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Format retrieval results into a context string for the LLM.
 */
export function formatRetrievalContext(results: SearchResult[]): string {
  if (results.length === 0) return '';

  const sections = results.map((r, i) => {
    const header = r.chunk.title ? `[${r.chunk.title}]` : `[Document ${i + 1}]`;
    const source = r.chunk.path ? ` (${r.chunk.path})` : '';
    return `${header}${source}\n${r.chunk.content}`;
  });

  return `Relevant context from EdLight knowledge base:\n\n${sections.join('\n\n---\n\n')}`;
}
