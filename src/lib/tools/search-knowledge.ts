import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { retrieveContext } from '@/lib/knowledge/retrieval';
import { DEFAULT_TOP_K } from '@/lib/config';

const inputSchema = z.object({
  query: z.string().min(1).describe('The search query to find relevant knowledge'),
  topK: z.number().min(1).max(20).optional().default(DEFAULT_TOP_K).describe('Maximum results to return'),
  platform: z.enum(['academy', 'code', 'news', 'initiative']).optional(),
  repo: z.string().optional().describe('Optional repository filter like owner/name'),
  contentType: z.union([
    z.enum(['course', 'program', 'news', 'documentation', 'repo_readme', 'code', 'general']),
    z.array(z.enum(['course', 'program', 'news', 'documentation', 'repo_readme', 'code', 'general'])),
  ]).optional(),
  preferPaths: z.array(z.string().min(1)).optional(),
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
      platform: {
        type: 'string',
        description: 'Optional EdLight platform filter',
        enum: ['academy', 'code', 'news', 'initiative'],
      },
      repo: {
        type: 'string',
        description: 'Optional repository filter like edlinitiative/EdLight-Academy',
      },
      contentType: {
        oneOf: [
          {
            type: 'string',
            enum: ['course', 'program', 'news', 'documentation', 'repo_readme', 'code', 'general'],
          },
          {
            type: 'array',
            items: {
              type: 'string',
              enum: ['course', 'program', 'news', 'documentation', 'repo_readme', 'code', 'general'],
            },
          },
        ],
        description: 'Optional content-type filter',
      },
      preferPaths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional path fragments to rank higher',
      },
    },
    required: ['query'],
  },
  inputSchema,
  requiredScopes: ['knowledge:read'],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    const filters = {
      platform: params.platform ?? null,
      repo: params.repo ?? null,
      contentType: params.contentType ?? null,
      preferPaths: params.preferPaths ?? [],
    };
    const results = await retrieveContext(params.query, {
      topK: params.topK,
      filter: {
        platform: params.platform,
        repo: params.repo,
        contentType: params.contentType,
        preferPaths: params.preferPaths,
      },
    });

    if (results.length === 0) {
      return {
        success: true,
        data: {
          query: params.query,
          filters,
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
        filters,
        results: results.map((r) => ({
          content: r.chunk.content,
          source: r.chunk.path ?? r.chunk.title ?? 'Unknown source',
          score: r.score,
          title: r.chunk.title,
          metadata: r.chunk.metadata ?? null,
        })),
        totalResults: results.length,
      },
    };
  },
};

// Auto-register
toolRegistry.register(searchKnowledgeBase);

export { searchKnowledgeBase };
