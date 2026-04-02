/**
 * Google Drive — read files and folders for knowledge indexing.
 *
 * Uses the Drive REST API v3 with service account impersonation.
 * Supports:
 *  - Listing files in folders (recursive)
 *  - Exporting Google Docs/Sheets/Slides as text
 *  - Downloading binary files and extracting text
 *  - Searching by name/content
 */

import { createLogger } from '@/lib/utils';
import { getContextToken, GOOGLE_SCOPES } from './auth';
import type {
  GoogleWorkspaceContext,
  DriveFile,
  DriveFileContent,
  DriveSearchOptions,
  DriveSearchResult,
} from './types';

const log = createLogger('google:drive');

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_SCOPES = [GOOGLE_SCOPES.DRIVE_READONLY];

// ─── MIME type mappings ──────────────────────────────────────────────────────

/** Google Workspace MIME types → export format for text extraction. */
const EXPORT_MIME_MAP: Record<string, { exportMime: string; method: 'export' }> = {
  'application/vnd.google-apps.document': { exportMime: 'text/plain', method: 'export' },
  'application/vnd.google-apps.spreadsheet': { exportMime: 'text/csv', method: 'export' },
  'application/vnd.google-apps.presentation': { exportMime: 'text/plain', method: 'export' },
};

/** Non-Google file types we can extract text from. */
const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/json',
  'application/xml',
  'text/xml',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function driveGet<T>(
  ctx: GoogleWorkspaceContext,
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const token = await getContextToken(ctx, DRIVE_SCOPES);
  const url = new URL(`${DRIVE_API}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API ${path} failed: ${res.status} — ${body}`);
  }

  return res.json() as Promise<T>;
}

function toDriveFile(item: Record<string, unknown>): DriveFile {
  return {
    id: item.id as string,
    name: item.name as string,
    mimeType: item.mimeType as string,
    modifiedTime: item.modifiedTime as string | undefined,
    size: item.size ? Number(item.size) : undefined,
    webViewLink: item.webViewLink as string | undefined,
    parents: item.parents as string[] | undefined,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List files in a Drive folder (one level deep).
 */
export async function listFolder(
  ctx: GoogleWorkspaceContext,
  folderId: string,
  pageToken?: string,
): Promise<DriveSearchResult> {
  log.info('Listing folder', { folderId, tenantId: ctx.tenantId });

  const query = `'${folderId}' in parents and trashed = false`;
  const data = await driveGet<{
    files: Record<string, unknown>[];
    nextPageToken?: string;
  }>(ctx, '/files', {
    q: query,
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,parents),nextPageToken',
    pageSize: '100',
    orderBy: 'modifiedTime desc',
    ...(pageToken ? { pageToken } : {}),
  });

  return {
    files: data.files.map(toDriveFile),
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Recursively list all files under a folder.
 * Returns a flat array with paths populated.
 */
export async function listFolderRecursive(
  ctx: GoogleWorkspaceContext,
  folderId: string,
  parentPath = '',
  maxDepth = 5,
): Promise<DriveFile[]> {
  if (maxDepth <= 0) return [];

  const result: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const page = await listFolder(ctx, folderId, pageToken);
    for (const file of page.files) {
      const filePath = parentPath ? `${parentPath}/${file.name}` : file.name;

      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const children = await listFolderRecursive(ctx, file.id, filePath, maxDepth - 1);
        result.push(...children);
      } else {
        result.push({ ...file, path: filePath });
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  return result;
}

/**
 * Search for files across Drive (or within specific folders).
 */
export async function searchFiles(
  ctx: GoogleWorkspaceContext,
  options: DriveSearchOptions,
): Promise<DriveSearchResult> {
  const clauses: string[] = ['trashed = false'];

  if (options.folderIds?.length) {
    const folderQ = options.folderIds.map((id) => `'${id}' in parents`).join(' or ');
    clauses.push(`(${folderQ})`);
  }
  if (options.query) {
    clauses.push(`(name contains '${options.query}' or fullText contains '${options.query}')`);
  }
  if (options.mimeType) {
    clauses.push(`mimeType = '${options.mimeType}'`);
  }

  const q = clauses.join(' and ');
  log.info('Searching Drive', { query: q, tenantId: ctx.tenantId });

  const data = await driveGet<{
    files: Record<string, unknown>[];
    nextPageToken?: string;
  }>(ctx, '/files', {
    q,
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,parents),nextPageToken',
    pageSize: String(options.maxResults ?? 20),
    orderBy: 'modifiedTime desc',
    ...(options.pageToken ? { pageToken: options.pageToken } : {}),
  });

  return {
    files: data.files.map(toDriveFile),
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Get the text content of a Drive file.
 *
 * - Google Docs/Sheets/Slides: exported to text/CSV
 * - Text files: downloaded directly
 * - Binary files: returns description only
 */
export async function getFileContent(
  ctx: GoogleWorkspaceContext,
  file: DriveFile,
): Promise<DriveFileContent> {
  const token = await getContextToken(ctx, DRIVE_SCOPES);

  // Google Workspace native files → export
  const exportInfo = EXPORT_MIME_MAP[file.mimeType];
  if (exportInfo) {
    const url = `${DRIVE_API}/files/${file.id}/export?mimeType=${encodeURIComponent(exportInfo.exportMime)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      log.warn('Export failed, falling back to description', { fileId: file.id, status: res.status });
      return { file, text: `[File: ${file.name}]`, extractionMethod: 'description_only' };
    }
    const text = await res.text();
    return { file, text, extractionMethod: 'export' };
  }

  // Plain text files → download
  if (TEXT_MIME_TYPES.has(file.mimeType)) {
    const url = `${DRIVE_API}/files/${file.id}?alt=media`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      return { file, text: `[File: ${file.name}]`, extractionMethod: 'description_only' };
    }
    const text = await res.text();
    return { file, text, extractionMethod: 'download' };
  }

  // Binary (PDF, images, etc.) — description only for now
  // Future: add PDF text extraction via pdf-parse or similar
  log.info('Binary file, description only', { fileId: file.id, mimeType: file.mimeType });
  return {
    file,
    text: `[Binary file: ${file.name} (${file.mimeType})]`,
    extractionMethod: 'description_only',
  };
}

/**
 * Get text content for multiple files (batch).
 * Processes sequentially to respect rate limits.
 */
export async function getFilesContent(
  ctx: GoogleWorkspaceContext,
  files: DriveFile[],
): Promise<DriveFileContent[]> {
  const results: DriveFileContent[] = [];
  for (const file of files) {
    try {
      results.push(await getFileContent(ctx, file));
    } catch (error) {
      log.warn('Failed to get content for file', {
        fileId: file.id,
        name: file.name,
        error: error instanceof Error ? error.message : 'unknown',
      });
      results.push({
        file,
        text: `[Error reading: ${file.name}]`,
        extractionMethod: 'description_only',
      });
    }
  }
  return results;
}
