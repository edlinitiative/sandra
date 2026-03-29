import { z } from 'zod';
import { toolRegistry } from './registry';
import type { ToolResult, ToolContext } from './types';
import { db, getActiveRepos, getRepoByRepoId } from '@/lib/db';
import { indexAllRepositories, indexRepositoriesByConfig, getConfiguredRepos } from '@/lib/github';
import { createLogger } from '@/lib/utils';

const log = createLogger('tools:trigger-indexing');

const inputSchema = z.object({
  repoId: z
    .string()
    .optional()
    .describe('Optional repo identifier (e.g. "edlinitiative/code" or "EdLight Academy"). If omitted, indexes all repos.'),
});

async function handler(input: z.infer<typeof inputSchema>, context: ToolContext): Promise<ToolResult> {
  log.info('Triggering repo indexing', { repoId: input.repoId, sessionId: context.sessionId });

  try {
    let results;

    if (input.repoId) {
      // Try to find in DB first
      const repo = await getRepoByRepoId(db, input.repoId);
      if (repo) {
        results = await indexAllRepositories([repo.id]);
      } else {
        // Try configured repos by name match
        const configuredRepos = getConfiguredRepos();
        const match = configuredRepos.find((config) => {
          const fullName = `${config.owner}/${config.name}`.toLowerCase();
          const displayName = config.displayName.toLowerCase();
          const needle = input.repoId!.toLowerCase();
          return fullName === needle || config.name.toLowerCase() === needle || displayName.includes(needle);
        });

        if (!match) {
          return {
            success: false,
            data: null,
            error: `Repository '${input.repoId}' not found. Available repos: ${configuredRepos.map((r) => r.displayName).join(', ')}`,
          };
        }
        results = await indexRepositoriesByConfig([match]);
      }
    } else {
      const repos = await getActiveRepos(db);
      results = repos.length > 0
        ? await indexAllRepositories(repos.map((r) => r.id))
        : await indexRepositoriesByConfig(getConfiguredRepos());
    }

    const failed = results.filter((r) => r.status === 'failed').length;
    const completed = results.length - failed;
    const totalDocs = results.reduce((sum, r) => sum + r.documentsProcessed, 0);

    return {
      success: true,
      data: {
        summary: `Indexed ${completed}/${results.length} repositories, ${totalDocs} documents processed`,
        results: results.map((r) => ({
          repo: r.repoFullName,
          status: r.status,
          documentsProcessed: r.documentsProcessed,
          duration: `${r.duration}ms`,
          error: r.error,
        })),
        status: failed === 0 ? 'completed' : completed > 0 ? 'partial' : 'failed',
      },
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Indexing failed',
    };
  }
}

toolRegistry.register({
  name: 'triggerRepoIndexing',
  description:
    'Trigger re-indexing of EdLight repositories. Optionally specify a single repo by name or ID. Requires admin scope.',
  parameters: {
    type: 'object',
    properties: {
      repoId: {
        type: 'string',
        description: 'Optional repo identifier. If omitted, all active repos are indexed.',
      },
    },
  },
  inputSchema,
  requiredScopes: ['admin:tools'],
  handler,
});
