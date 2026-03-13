import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { retrieveContext } from '@/lib/knowledge/retrieval';
import { DEFAULT_TOP_K } from '@/lib/config';

const inputSchema = z.object({
  query: z.string().min(1).describe('The search query to find relevant knowledge'),
  topK: z.number().min(1).max(20).optional().default(DEFAULT_TOP_K).describe('Maximum results to return'),
});

const searchKnowledgeBase: SandraTool = {
  name: 'searchKnowledgeBase',
  description:
    "Search Sandra's knowledge base for information about EdLight initiatives, documentation, and indexed content. Use this when users ask questions about EdLight platforms, features, or documentation.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query to find relevant knowledge' },
      topK: { type: 'number', description: 'Maximum results to return', default: DEFAULT_TOP_K },
    },
    required: ['query'],
  },
  inputSchema,
  requiredScopes: ['knowledge:read'],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    const results = await retrieveContext(params.query, { topK: params.topK });

    if (results.length === 0) {
      return {
        success: true,
        data: {
          query: params.query,
          results: [],
          message: 'No relevant documents found. The knowledge base may be empty or the query did not match any indexed content.',
          totalResults: 0,
        },
      };
    }

    return {
      success: true,
      data: {
        query: params.query,
        results: results.map((r) => ({
          content: r.chunk.content,
          source: r.chunk.path ?? r.chunk.title ?? 'Unknown source',
          score: r.score,
          title: r.chunk.title,
        })),
        totalResults: results.length,
      },
    };
  },
};

// Auto-register
toolRegistry.register(searchKnowledgeBase);

export { searchKnowledgeBase };
