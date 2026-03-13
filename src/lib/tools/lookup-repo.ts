import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { db } from '@/lib/db';
import { getActiveRepos, getRepoByOwnerAndName } from '@/lib/db/repos';

const inputSchema = z.object({
  repoName: z.string().optional().describe('Repository name to look up (optional — omit to list all)'),
});

const lookupRepoInfo: SandraTool = {
  name: 'lookupRepoInfo',
  description:
    'Look up information about EdLight GitHub repositories. Returns repo metadata, description, and indexing status. Omit repoName to list all active repos.',
  parameters: {
    type: 'object',
    properties: {
      repoName: { type: 'string', description: 'Repository name (optional)' },
    },
    required: [],
  },
  inputSchema,
  requiredScopes: ['repos:read'],

  async handler(input: unknown, _context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    if (params.repoName) {
      // Search by name across all known owners
      const repos = await getActiveRepos(db);
      const match = repos.find(
        (r) => r.name.toLowerCase() === params.repoName!.toLowerCase() ||
               r.displayName.toLowerCase().includes(params.repoName!.toLowerCase()),
      );
      if (!match) {
        return {
          success: true,
          data: {
            repos: [],
            message: `No repository found matching '${params.repoName}'`,
          },
        };
      }
      return {
        success: true,
        data: {
          repos: [formatRepo(match)],
        },
      };
    }

    // Return all active repos
    const repos = await getActiveRepos(db);
    return {
      success: true,
      data: {
        repos: repos.map(formatRepo),
      },
    };
  },
};

function formatRepo(repo: Awaited<ReturnType<typeof getRepoByOwnerAndName>>) {
  if (!repo) return null;
  return {
    name: repo.name,
    displayName: repo.displayName,
    description: repo.description,
    url: repo.url,
    syncStatus: repo.syncStatus,
    lastSyncAt: repo.lastSyncAt,
  };
}

toolRegistry.register(lookupRepoInfo);

export { lookupRepoInfo };
