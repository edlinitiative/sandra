import { NextResponse } from 'next/server';
import { getConfiguredRepos } from '@/lib/github';
import { getVectorStore } from '@/lib/knowledge';
import { errorResponse } from '@/lib/utils';

export async function GET() {
  try {
    const repos = getConfiguredRepos(true);
    const vectorStore = getVectorStore();

    const reposWithStatus = await Promise.all(
      repos.map(async (repo) => {
        const chunkCount = await vectorStore.count(`${repo.owner}/${repo.name}`);
        return {
          owner: repo.owner,
          name: repo.name,
          displayName: repo.displayName,
          description: repo.description,
          url: repo.url,
          branch: repo.branch,
          docsPath: repo.docsPath,
          isActive: repo.isActive,
          indexed: chunkCount > 0,
          chunkCount,
        };
      }),
    );

    return NextResponse.json({
      data: {
        repos: reposWithStatus,
        totalRepos: repos.length,
        activeRepos: repos.filter((r) => r.isActive).length,
      },
    });
  } catch (error) {
    const err = errorResponse(error);
    return NextResponse.json({ error: err.error }, { status: err.status });
  }
}
