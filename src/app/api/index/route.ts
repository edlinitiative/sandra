import { NextResponse } from 'next/server';
import { z } from 'zod';
import { indexRepository, indexAllRepositories, getConfiguredRepos, findRepoConfig } from '@/lib/github';
import { errorResponse } from '@/lib/utils';

const indexRequestSchema = z.object({
  /** If provided, index only this repo. Otherwise index all. */
  owner: z.string().optional(),
  repo: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = indexRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', issues: parsed.error.issues } },
        { status: 400 },
      );
    }

    const { owner, repo } = parsed.data;

    if (owner && repo) {
      // Index a specific repo
      const repoConfig = findRepoConfig(owner, repo);
      if (!repoConfig) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: `Repository ${owner}/${repo} not found in registry` } },
          { status: 404 },
        );
      }

      const result = await indexRepository(repoConfig);
      return NextResponse.json({ data: { results: [result] } });
    }

    // Index all configured repos
    const repos = getConfiguredRepos();
    const results = await indexAllRepositories(repos);

    return NextResponse.json({
      data: {
        results,
        totalRepos: repos.length,
        totalFiles: results.reduce((sum, r) => sum + r.filesIndexed, 0),
        totalChunks: results.reduce((sum, r) => sum + r.chunksCreated, 0),
      },
    });
  } catch (error) {
    const err = errorResponse(error);
    return NextResponse.json({ error: err.error }, { status: err.status });
  }
}
