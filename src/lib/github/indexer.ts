import type { RepoConfig, IndexingResult } from './types';
import type { RawDocument } from '@/lib/knowledge/types';
import { fetchRepoContent } from './fetcher';
import { ingestDocuments, removeSource } from '@/lib/knowledge';
import { createLogger } from '@/lib/utils';

const log = createLogger('github:indexer');

/**
 * Index a single repository into the Sandra knowledge base.
 */
export async function indexRepository(repo: RepoConfig): Promise<IndexingResult> {
  const repoFullName = `${repo.owner}/${repo.name}`;
  const startTime = Date.now();
  const errors: string[] = [];

  log.info(`Starting indexing for ${repoFullName}`);

  try {
    // 1. Fetch content from GitHub
    const files = await fetchRepoContent(repo);

    if (files.length === 0) {
      log.warn(`No indexable files found for ${repoFullName}`);
      return {
        repoFullName,
        filesIndexed: 0,
        chunksCreated: 0,
        errors: ['No indexable files found'],
        duration: Date.now() - startTime,
      };
    }

    // 2. Convert to RawDocuments
    const documents: RawDocument[] = files.map((file) => ({
      sourceId: repoFullName,
      title: `${repo.displayName} — ${file.name}`,
      path: file.path,
      content: file.content,
      metadata: {
        repo: repoFullName,
        sha: file.sha,
        url: file.url,
        platform: repo.displayName,
      },
    }));

    // 3. Remove old indexed content for this source
    await removeSource(repoFullName);

    // 4. Ingest new content
    const result = await ingestDocuments(documents);

    log.info(`Indexing complete for ${repoFullName}`, {
      filesIndexed: files.length,
      chunksCreated: result.totalChunks,
    });

    return {
      repoFullName,
      filesIndexed: files.length,
      chunksCreated: result.totalChunks,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Indexing failed for ${repoFullName}`, { error: msg });
    errors.push(msg);

    return {
      repoFullName,
      filesIndexed: 0,
      chunksCreated: 0,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Index all configured repositories.
 */
export async function indexAllRepositories(repos: RepoConfig[]): Promise<IndexingResult[]> {
  log.info(`Starting batch indexing for ${repos.length} repositories`);

  const results: IndexingResult[] = [];
  for (const repo of repos) {
    const result = await indexRepository(repo);
    results.push(result);
  }

  const totalFiles = results.reduce((sum, r) => sum + r.filesIndexed, 0);
  const totalChunks = results.reduce((sum, r) => sum + r.chunksCreated, 0);
  log.info(`Batch indexing complete: ${totalFiles} files, ${totalChunks} chunks across ${repos.length} repos`);

  return results;
}
