/**
 * webSearch — perform a real-time web search via the Brave Search API.
 *
 * Returns the top results for any query, giving Sandra real-time awareness
 * beyond the indexed knowledge base.
 *
 * Requires BRAVE_SEARCH_API_KEY to be set in the environment.
 *
 * Required scopes: public (none required)
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { env } from '@/lib/config';

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(400)
    .describe('The search query'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe('Maximum number of results to return (default 5)'),
  country: z
    .string()
    .length(2)
    .optional()
    .default('HT')
    .describe("Two-letter country code to bias results, e.g. 'HT' (Haiti), 'US', 'FR'"),
  language: z
    .enum(['en', 'fr', 'ht'])
    .optional()
    .default('en')
    .describe("Preferred language for results: 'en', 'fr', or 'ht'"),
});

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

async function braveSearch(
  query: string,
  options: { count?: number; country?: string; language?: string },
): Promise<BraveSearchResult[]> {
  const apiKey = env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error('Web search is not configured (BRAVE_SEARCH_API_KEY missing).');
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(options.count ?? 5));
  if (options.country) url.searchParams.set('country', options.country);
  if (options.language) url.searchParams.set('search_lang', options.language);
  url.searchParams.set('text_decorations', 'false');
  url.searchParams.set('safesearch', 'moderate');

  const res = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brave Search API error: ${res.status} — ${body}`);
  }

  const data = await res.json() as {
    web?: {
      results?: Array<{
        title: string;
        url: string;
        description?: string;
        page_age?: string;
      }>;
    };
  };

  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description ?? '',
    age: r.page_age,
  }));
}

const webSearchTool: SandraTool = {
  name: 'webSearch',
  description:
    "Search the web in real-time for current information, news, events, or any topic not covered by Sandra's knowledge base. Use when the user asks about recent events, current prices, today's news, or any information that might be out of date in the knowledge base.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', description: 'Number of results (default 5)', default: 5 },
      country: { type: 'string', description: "Two-letter country code, e.g. 'HT', 'US', 'FR'", default: 'HT' },
      language: {
        type: 'string',
        enum: ['en', 'fr', 'ht'],
        description: "Preferred language for results",
        default: 'en',
      },
    },
    required: ['query'],
  },
  inputSchema,
  requiredScopes: [],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    try {
      const results = await braveSearch(params.query, {
        count: params.maxResults,
        country: params.country,
        language: params.language === 'ht' ? 'fr' : params.language, // Brave doesn't support HT; use FR as closest
      });

      if (results.length === 0) {
        return {
          success: true,
          data: {
            message: `No web results found for "${params.query}".`,
            results: [],
          },
        };
      }

      return {
        success: true,
        data: {
          query: params.query,
          resultCount: results.length,
          results: results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.description,
            age: r.age,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Web search failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(webSearchTool);
export { webSearchTool };
