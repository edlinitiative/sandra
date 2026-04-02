import { z } from 'zod';
import { toolRegistry } from './registry';
import type { ToolResult, ToolContext } from './types';
import { db } from '@/lib/db';
import { getVectorStore } from '@/lib/knowledge';
import { createLogger } from '@/lib/utils';

const log = createLogger('tools:indexing-status');

const inputSchema = z.object({}).strict();

async function handler(_input: unknown, context: ToolContext): Promise<ToolResult> {
  log.info('Fetching indexing status', { sessionId: context.sessionId });

  try {
    const repos = await db.repoRegistry.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        owner: true,
        name: true,
        displayName: true,
        syncStatus: true,
        lastSyncAt: true,
      },
    });

    const sources = await db.indexedSource.findMany({
      select: {
        owner: true,
        repo: true,
        documentCount: true,
        lastIndexedAt: true,
      },
    });

    const sourceByKey = new Map(sources.map((s) => [`${s.owner}/${s.repo}`, s]));

    let vectorChunks: number | null = null;
    try {
      const vs = getVectorStore();
      vectorChunks = await vs.count();
    } catch {
      // Best effort
    }

    const repoStatuses = repos.map((repo) => {
      const key = `${repo.owner}/${repo.name}`;
      const source = sourceByKey.get(key);
      return {
        name: repo.displayName,
        repoFullName: key,
        syncStatus: repo.syncStatus,
        lastIndexed: repo.lastSyncAt?.toISOString() ?? 'never',
        documentCount: source?.documentCount ?? 0,
      };
    });

    const summary = {
      totalRepos: repos.length,
      indexed: repos.filter((r) => r.syncStatus === 'indexed').length,
      indexing: repos.filter((r) => r.syncStatus === 'indexing').length,
      error: repos.filter((r) => r.syncStatus === 'error').length,
      notIndexed: repos.filter((r) => r.syncStatus === 'not_indexed').length,
      vectorStoreChunks: vectorChunks,
    };

    return {
      success: true,
      data: { repos: repoStatuses, summary },
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch indexing status',
    };
  }
}

toolRegistry.register({
  name: 'getIndexingStatus',
  description:
    'Get the current indexing status for all registered EdLight repositories, including document counts and sync status. Requires admin scope.',
  parameters: {
    type: 'object',
    properties: {},
  },
  inputSchema,
  requiredScopes: ['admin:tools'],
  handler,
});
