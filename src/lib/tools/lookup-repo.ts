import { z } from 'zod';
import type { SandraTool, ToolResult } from './types';
import { toolRegistry } from './registry';

const inputSchema = z.object({
  owner: z.string().default('edlinitiative').describe('GitHub organization or user'),
  repo: z.string().describe('Repository name'),
});

const lookupRepoInfo: SandraTool = {
  name: 'lookupRepoInfo',
  description:
    'Look up information about a specific EdLight GitHub repository. Returns metadata, description, and indexing status.',
  parameters: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: 'GitHub organization or user', default: 'edlinitiative' },
      repo: { type: 'string', description: 'Repository name' },
    },
    required: ['repo'],
  },
  inputSchema,

  async execute(input: unknown): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    // TODO: Wire to GitHub client + RepoRegistry in database
    // For now, return placeholder info
    return {
      success: true,
      data: {
        owner: params.owner,
        repo: params.repo,
        url: `https://github.com/${params.owner}/${params.repo}`,
        indexed: false,
        message: `Repository ${params.owner}/${params.repo} is registered but not yet indexed. Trigger indexing from the admin panel.`,
      },
    };
  },
};

toolRegistry.register(lookupRepoInfo);

export { lookupRepoInfo };
