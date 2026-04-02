import * as crypto from 'crypto';
import type { RepoConfig, IndexingResult } from './types';
import type { RawDocument } from '@/lib/knowledge/types';
import { fetchRepoContent } from './fetcher';
import { ingestDocuments, removeSource } from '@/lib/knowledge';
import { createLogger } from '@/lib/utils';
import { db } from '@/lib/db/client';
import {
  computePathPriority,
  deriveContentType,
  displayNameForPlatform,
  platformFromRepo,
} from '@/lib/knowledge/platform-metadata';
import {
  getRepoById,
  updateRepoSyncStatus,
  createOrUpdateSource,
  saveIndexedDocuments,
  deleteDocumentsForSource,
} from '@/lib/db';

const log = createLogger('github:indexer');

/** In-memory map of latest indexing results, keyed by repoId */
const indexingResults = new Map<string, IndexingResult>();

// ── Content Hash Utilities ────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash of content for change detection.
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Check if content has changed compared to what's stored in the DB.
 * Returns true if the document is new or has changed.
 */
export async function hasContentChanged(
  sourceId: string,
  path: string,
  newHash: string,
): Promise<boolean> {
  const existing = await db.indexedDocument.findFirst({
    where: { sourceId, path, contentHash: newHash },
  });
  // If no matching document found, content is new or changed
  return existing === null;
}

// ── Indexing Orchestrator ─────────────────────────────────────────────────────

/**
 * Index a repository by its DB record ID.
 * Fetches content from GitHub, checks for changes, and runs the ingestion pipeline.
 */
export async function indexRepository(repoId: string): Promise<IndexingResult> {
  const startedAt = new Date();
  const startTime = Date.now();
  const errors: string[] = [];

  // 1. Look up repo in database
  const repoRecord = await getRepoById(db, repoId);
  if (!repoRecord) {
    const error = `Repository not found: ${repoId}`;
    log.error(error);
    const result: IndexingResult = {
      repoId,
      repoFullName: repoId,
      status: 'failed',
      documentsProcessed: 0,
      documentsSkipped: 0,
      documentsFailed: 0,
      startedAt,
      completedAt: new Date(),
      error,
      filesIndexed: 0,
      chunksCreated: 0,
      errors: [error],
      duration: Date.now() - startTime,
    };
    indexingResults.set(repoId, result);
    return result;
  }

  const repoConfig: RepoConfig = {
    owner: repoRecord.owner,
    name: repoRecord.name,
    displayName: repoRecord.displayName,
    description: repoRecord.description ?? '',
    url: repoRecord.url,
    branch: repoRecord.branch,
    docsPath: repoRecord.docsPath ?? undefined,
    isActive: repoRecord.isActive,
  };
  const repoFullName = `${repoRecord.owner}/${repoRecord.name}`;
  const platform = platformFromRepo(repoRecord.name, repoRecord.displayName);

  log.info(`Starting indexing for ${repoFullName}`, { repoId });

  // 2. Set syncStatus to 'indexing'
  try {
    await updateRepoSyncStatus(db, repoId, 'indexing');
  } catch (e) {
    log.warn('Failed to set syncStatus=indexing', { repoId, error: e instanceof Error ? e.message : 'unknown' });
  }

  try {
    // 3. Create/update IndexedSource record
    const source = await createOrUpdateSource(db, {
      name: repoRecord.displayName,
      type: 'github_repo',
      url: repoRecord.url,
      owner: repoRecord.owner,
      repo: repoRecord.name,
      branch: repoRecord.branch,
    });

    // 4. Fetch content from GitHub
    const files = await fetchRepoContent(repoConfig);

    if (files.length === 0) {
      log.warn(`No indexable files found for ${repoFullName}`);
      await updateRepoSyncStatus(db, repoId, 'indexed');

      const result: IndexingResult = {
        repoId,
        repoFullName,
        status: 'completed',
        documentsProcessed: 0,
        documentsSkipped: 0,
        documentsFailed: 0,
        startedAt,
        completedAt: new Date(),
        filesIndexed: 0,
        chunksCreated: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
      indexingResults.set(repoId, result);
      return result;
    }

    // 5. Check for changes using content hash
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const changedDocuments: RawDocument[] = [];

    for (const file of files) {
      const hash = computeContentHash(file.content);
      try {
        const changed = await hasContentChanged(source.id, file.path, hash);
        if (changed) {
          const contentType = deriveContentType(file.path, file.content, platform);
          changedDocuments.push({
            sourceId: repoFullName, // Use human-readable ID for vector store
            title: `${repoRecord.displayName} — ${file.name}`,
            path: file.path,
            content: file.content,
            metadata: {
              repo: repoFullName,
              sha: file.sha,
              url: file.url,
              platform: repoRecord.displayName,
              platformKey: platform,
              platformDisplayName: platform ? displayNameForPlatform(platform) : repoRecord.displayName,
              contentType,
              pathPriority: computePathPriority(file.path, contentType),
              contentHash: hash,
            },
          });
          processed++;
        } else {
          skipped++;
        }
      } catch (e) {
        log.warn(`Failed hash check for ${file.path}`, { error: e instanceof Error ? e.message : 'unknown' });
        const contentType = deriveContentType(file.path, file.content, platform);
        changedDocuments.push({
          sourceId: repoFullName,
          title: `${repoRecord.displayName} — ${file.name}`,
          path: file.path,
          content: file.content,
          metadata: {
            repo: repoFullName,
            url: file.url,
            platform: repoRecord.displayName,
            platformKey: platform,
            platformDisplayName: platform ? displayNameForPlatform(platform) : repoRecord.displayName,
            contentType,
            pathPriority: computePathPriority(file.path, contentType),
          },
        });
        processed++;
      }
    }

    log.info(`${repoFullName}: ${files.length} files found, ${processed} changed, ${skipped} skipped`);

    let totalChunks = 0;

    if (changedDocuments.length > 0) {
      // 6. Remove old vector store content for this source
      await removeSource(repoFullName);

      // 7. Ingest changed documents through RAG pipeline
      const ingestResult = await ingestDocuments(changedDocuments);
      totalChunks = ingestResult.totalChunks;

      // 8. Clean up old IndexedDocument DB records and save new ones
      await deleteDocumentsForSource(db, source.id);

      await saveIndexedDocuments(
        db,
        source.id,
        changedDocuments.map((doc, i) => ({
          title: doc.title,
          path: doc.path,
          content: doc.content,
          contentHash: doc.metadata?.contentHash as string | undefined ??
            computeContentHash(doc.content),
          chunkIndex: i,
          chunkTotal: changedDocuments.length,
          metadata: doc.metadata,
        })),
      );
    }

    // 9. Set syncStatus to 'indexed'
    await updateRepoSyncStatus(db, repoId, 'indexed');

    log.info(`Indexing complete for ${repoFullName}`, {
      filesIndexed: files.length,
      chunksCreated: totalChunks,
      processed,
      skipped,
    });

    const result: IndexingResult = {
      repoId,
      repoFullName,
      status: 'completed',
      documentsProcessed: processed,
      documentsSkipped: skipped,
      documentsFailed: failed,
      startedAt,
      completedAt: new Date(),
      filesIndexed: files.length,
      chunksCreated: totalChunks,
      errors,
      duration: Date.now() - startTime,
    };
    indexingResults.set(repoId, result);
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Indexing failed for ${repoFullName}`, { error: msg, repoId });
    errors.push(msg);

    try {
      await updateRepoSyncStatus(db, repoId, 'error');
    } catch {
      // Best effort
    }

    const result: IndexingResult = {
      repoId,
      repoFullName,
      status: 'failed',
      documentsProcessed: 0,
      documentsSkipped: 0,
      documentsFailed: 0,
      startedAt,
      completedAt: new Date(),
      error: msg,
      filesIndexed: 0,
      chunksCreated: 0,
      errors,
      duration: Date.now() - startTime,
    };
    indexingResults.set(repoId, result);
    return result;
  }
}

/**
 * Get the latest indexing result for a repository.
 */
export function getIndexingResult(repoId: string): IndexingResult | undefined {
  return indexingResults.get(repoId);
}

/**
 * Index all configured repositories by their DB IDs.
 */
export async function indexAllRepositories(repoIds: string[]): Promise<IndexingResult[]> {
  log.info(`Starting batch indexing for ${repoIds.length} repositories`);

  const results: IndexingResult[] = [];
  for (const repoId of repoIds) {
    const result = await indexRepository(repoId);
    results.push(result);
  }

  const totalProcessed = results.reduce((sum, r) => sum + r.documentsProcessed, 0);
  const totalChunks = results.reduce((sum, r) => sum + r.chunksCreated, 0);
  log.info(`Batch indexing complete: ${totalProcessed} docs, ${totalChunks} chunks across ${repoIds.length} repos`);

  return results;
}

/**
 * Index all repositories by RepoConfig (backward compat helper).
 * @deprecated Use indexAllRepositories with DB IDs instead.
 */
export async function indexRepositoriesByConfig(repos: RepoConfig[]): Promise<IndexingResult[]> {
  log.info(`Starting batch indexing for ${repos.length} repositories (by config)`);

  const results: IndexingResult[] = [];
  for (const repo of repos) {
    const repoFullName = `${repo.owner}/${repo.name}`;
    const startedAt = new Date();
    const startTime = Date.now();
    const platform = platformFromRepo(repo.name, repo.displayName);

    try {
      await removeSource(repoFullName);
      const files = await fetchRepoContent(repo);
      const documents: RawDocument[] = files.map((file) => ({
        sourceId: repoFullName,
        title: `${repo.displayName} — ${file.name}`,
        path: file.path,
        content: file.content,
        metadata: {
          repo: repoFullName,
          url: file.url,
          platform: repo.displayName,
          platformKey: platform,
          platformDisplayName: platform ? displayNameForPlatform(platform) : repo.displayName,
          contentType: deriveContentType(file.path, file.content, platform),
          pathPriority: computePathPriority(
            file.path,
            deriveContentType(file.path, file.content, platform),
          ),
        },
      }));

      const ingestResult = files.length > 0 ? await ingestDocuments(documents) : { totalChunks: 0 };

      results.push({
        repoId: repoFullName,
        repoFullName,
        status: 'completed',
        documentsProcessed: files.length,
        documentsSkipped: 0,
        documentsFailed: 0,
        startedAt,
        completedAt: new Date(),
        filesIndexed: files.length,
        chunksCreated: ingestResult.totalChunks,
        errors: [],
        duration: Date.now() - startTime,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        repoId: repoFullName,
        repoFullName,
        status: 'failed',
        documentsProcessed: 0,
        documentsSkipped: 0,
        documentsFailed: 0,
        startedAt,
        completedAt: new Date(),
        error: msg,
        filesIndexed: 0,
        chunksCreated: 0,
        errors: [msg],
        duration: Date.now() - startTime,
      });
    }
  }

  return results;
}
