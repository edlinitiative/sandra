import { getVectorStore } from './vector-store';
import { embedQuery } from './embeddings';
import type { RetrieveContextOptions, SearchResult } from './types';
import { DEFAULT_TOP_K } from '@/lib/config';
import { createLogger } from '@/lib/utils';

const log = createLogger('knowledge:retrieval');

// ─── Platform keyword map for reranking ──────────────────────────────────────

const PLATFORM_KEYWORDS: Record<string, string[]> = {
  academy: ['academy', 'maths', 'physics', 'chemistry', 'economics', 'video lesson', 'bilingual', 'creole'],
  code: ['code', 'coding', 'sql', 'python', 'javascript', 'html', 'css', 'terminal', 'git', 'certificate'],
  news: ['news', 'announcement', 'update', 'event', 'scholarship', 'opportunity'],
  initiative: ['initiative', 'edlight', 'eslp', 'nexus', 'leadership', 'exchange', 'program', 'labs'],
  labs: ['labs', 'digital product', 'website', 'innovation', 'maker lab'],
};

/**
 * Rerank results by boosting score when chunk platform matches query keywords.
 * Score boost: +0.12 for a strong platform match, +0.06 for a weak match.
 */
export function rerankResults(results: SearchResult[], query: string): SearchResult[] {
  const queryLower = query.toLowerCase();

  // Detect which platforms are mentioned in the query
  const matchedPlatforms = new Set<string>();
  for (const [platform, keywords] of Object.entries(PLATFORM_KEYWORDS)) {
    if (keywords.some((kw) => queryLower.includes(kw))) {
      matchedPlatforms.add(platform);
    }
  }

  // No platform signal — return as-is
  if (matchedPlatforms.size === 0) return results;

  const reranked = results.map((r) => {
    const chunkPlatform = typeof r.chunk.metadata?.platform === 'string'
      ? r.chunk.metadata.platform.toLowerCase()
      : null;

    if (chunkPlatform && matchedPlatforms.has(chunkPlatform)) {
      return { ...r, score: Math.min(1.0, r.score + 0.12) };
    }
    return r;
  });

  // Re-sort by boosted scores
  return reranked.sort((a, b) => b.score - a.score);
}

/**
 * High-level retrieval service.
 * Embeds a query, searches the vector store, and reranks results.
 */
export async function retrieveContext(
  query: string,
  options?: RetrieveContextOptions,
): Promise<SearchResult[]> {
  const topK = options?.topK ?? DEFAULT_TOP_K;
  const minScore = options?.minScore ?? 0.2;

  try {
    const queryEmbedding = await embedQuery(query);
    const store = getVectorStore();
    const results = await store.search(queryEmbedding, topK, options?.filter);

    // Filter by minimum score
    const filtered = results.filter((r) => r.score >= minScore);

    // Rerank: boost platform-matching chunks
    const reranked = rerankResults(filtered, query);

    log.info(`Retrieved ${reranked.length} results for query`, {
      query: query.slice(0, 80),
      topK,
      minScore,
      totalResults: results.length,
      filteredResults: reranked.length,
    });

    return reranked;
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
    const metadataBits = [
      typeof r.chunk.metadata?.platform === 'string' ? r.chunk.metadata.platform : null,
      typeof r.chunk.metadata?.contentType === 'string' ? r.chunk.metadata.contentType : null,
    ].filter((value): value is string => Boolean(value));
    const metadataSuffix = metadataBits.length > 0 ? ` {${metadataBits.join(', ')}}` : '';
    return `${header}${source}${metadataSuffix}\n${r.chunk.content}`;
  });

  return `Relevant context from EdLight knowledge base:\n\n${sections.join('\n\n---\n\n')}`;
}
