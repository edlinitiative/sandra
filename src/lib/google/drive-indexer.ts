/**
 * Google Drive → Knowledge Pipeline indexer.
 *
 * Reads files from configured Drive folders, extracts text,
 * chunks them via the existing knowledge chunker, embeds, and
 * stores in the vector DB with a tenant-scoped sourceId.
 *
 * Uses the existing knowledge pipeline (chunker → embedder → vector store)
 * so Drive content is searchable alongside GitHub-indexed content.
 */

import { createLogger } from '@/lib/utils';
import { resolveGoogleContext } from '@/lib/google/context';
import { listFolderRecursive, listAllFiles, getFileContent } from '@/lib/google/drive';
import { chunkDocument } from '@/lib/knowledge/chunker';
import { embedChunks } from '@/lib/knowledge/embeddings';
import { getVectorStore } from '@/lib/knowledge/vector-store';
import type { RawDocument } from '@/lib/knowledge/types';
import type { DriveFile } from '@/lib/google/types';
import { db } from '@/lib/db';

const log = createLogger('google:drive-indexer');

/** Options for a Drive indexing run. */
export interface DriveIndexOptions {
  tenantId: string;
  /** Override folder IDs (defaults to ConnectedProvider.config.driveFolderIds) */
  folderIds?: string[];
  /** Max files to process per run (default 100) */
  maxFiles?: number;
  /** Force re-index even if contentHash matches */
  force?: boolean;
}

/** Result of a Drive indexing run. */
export interface DriveIndexResult {
  tenantId: string;
  filesScanned: number;
  filesIndexed: number;
  chunksCreated: number;
  errors: Array<{ file: string; error: string }>;
  durationMs: number;
}

/**
 * Index Google Drive files into the knowledge vector store.
 *
 * Flow:
 * 1. List all files in configured folders (recursive)
 * 2. Extract text content from each file
 * 3. Chunk using the standard markdown-aware chunker
 * 4. Embed chunks via OpenAI
 * 5. Upsert into the vector store with sourceId = `drive:{tenantSlug}`
 */
export async function indexDriveFiles(options: DriveIndexOptions): Promise<DriveIndexResult> {
  const start = Date.now();
  const { tenantId, force = false, maxFiles = 100 } = options;

  log.info('Starting Drive indexing', { tenantId, maxFiles, force });

  // Resolve tenant and Google context
  const rawCtx = await resolveGoogleContext(tenantId);
  // Use the configured Drive impersonation email if set
  const ctx = rawCtx.config.driveImpersonateEmail
    ? { ...rawCtx, impersonateEmail: rawCtx.config.driveImpersonateEmail }
    : rawCtx;
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const sourceId = `drive:${tenant.slug}`;
  const folderIds = options.folderIds ?? ctx.config.driveFolderIds ?? [];

  // 1. Collect files — from specific folders, or entire Drive if none configured
  const allFiles: DriveFile[] = [];
  if (folderIds.length > 0) {
    for (const folderId of folderIds) {
      try {
        const files = await listFolderRecursive(ctx, folderId);
        allFiles.push(...files);
      } catch (error) {
        log.error('Failed to list folder', { folderId, error: (error as Error).message });
      }
    }
  } else {
    // No specific folders — index the entire Drive
    log.info('No folder IDs configured, indexing entire Drive', { tenantId });
    try {
      const files = await listAllFiles(ctx, maxFiles);
      allFiles.push(...files);
    } catch (error) {
      log.error('Failed to list all Drive files', { error: (error as Error).message });
    }
  }

  const filesToProcess = allFiles.slice(0, maxFiles);
  log.info(`Found ${allFiles.length} files, processing ${filesToProcess.length}`, { tenantId });

  const result: DriveIndexResult = {
    tenantId,
    filesScanned: filesToProcess.length,
    filesIndexed: 0,
    chunksCreated: 0,
    errors: [],
    durationMs: 0,
  };

  const store = getVectorStore();

  // 2–5. Process each file through the knowledge pipeline
  for (const file of filesToProcess) {
    try {
      // Extract text
      const content = await getFileContent(ctx, file);

      if (!content.text || content.text.startsWith('[Binary file:') || content.text.startsWith('[Error')) {
        log.info('Skipping non-text file', { name: file.name, mimeType: file.mimeType });
        continue;
      }

      // Build RawDocument compatible with existing chunker
      const rawDoc: RawDocument = {
        sourceId,
        title: file.name,
        path: file.path ?? file.name,
        content: content.text,
        metadata: {
          driveFileId: file.id,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          webViewLink: file.webViewLink,
          tenantId,
          platform: 'drive',
          contentType: 'documentation',
        },
      };

      // Chunk
      const chunks = chunkDocument(rawDoc);
      if (chunks.length === 0) continue;

      // Skip if content hasn't changed (unless force)
      if (!force && chunks[0]?.contentHash) {
        const existing = await db.indexedDocument.findFirst({
          where: { sourceId, path: rawDoc.path, contentHash: chunks[0].contentHash },
          select: { id: true },
        });
        if (existing) {
          log.info('File unchanged, skipping', { name: file.name });
          continue;
        }
      }

      // Embed
      const embedded = await embedChunks(chunks);

      // Upsert into vector store
      await store.upsert(embedded);

      result.filesIndexed++;
      result.chunksCreated += embedded.length;
      log.info('Indexed file', { name: file.name, chunks: embedded.length });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'unknown';
      log.error('Failed to index file', { name: file.name, error: errMsg });
      result.errors.push({ file: file.name, error: errMsg });
    }
  }

  // Update or create IndexedSource record
  await db.indexedSource.upsert({
    where: { type_url: { type: 'drive', url: `drive://${tenant.slug}` } },
    create: {
      name: `Google Drive — ${tenant.slug}`,
      type: 'drive',
      url: `drive://${tenant.slug}`,
      status: 'indexed',
      lastIndexedAt: new Date(),
      documentCount: result.chunksCreated,
      metadata: { tenantId, folderIds },
    },
    update: {
      status: 'indexed',
      lastIndexedAt: new Date(),
      documentCount: { increment: result.chunksCreated },
      metadata: { tenantId, folderIds },
    },
  });

  result.durationMs = Date.now() - start;
  log.info('Drive indexing complete', { ...result });

  return result;
}
