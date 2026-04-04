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
const DOCS_API = 'https://docs.googleapis.com/v1';
const SHEETS_API = 'https://sheets.googleapis.com/v4';
const DRIVE_SCOPES = [GOOGLE_SCOPES.DRIVE_READONLY];
const DRIVE_WRITE_SCOPES = [GOOGLE_SCOPES.DRIVE_FILE];

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
 * List ALL non-folder files in the user's Drive (paginated).
 * Used for whole-Drive indexing when no specific folder IDs are configured.
 */
export async function listAllFiles(
  ctx: GoogleWorkspaceContext,
  maxFiles = 500,
): Promise<DriveFile[]> {
  log.info('Listing all Drive files', { tenantId: ctx.tenantId, maxFiles });

  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const data = await driveGet<{
      files: Record<string, unknown>[];
      nextPageToken?: string;
    }>(ctx, '/files', {
      q: "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
      fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,parents),nextPageToken',
      pageSize: '100',
      orderBy: 'modifiedTime desc',
      ...(pageToken ? { pageToken } : {}),
    });

    allFiles.push(...data.files.map(toDriveFile));
    pageToken = data.nextPageToken;
  } while (pageToken && allFiles.length < maxFiles);

  log.info(`Listed ${allFiles.length} files from Drive`, { tenantId: ctx.tenantId });
  return allFiles.slice(0, maxFiles);
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

// ─── Create / Share / Get ────────────────────────────────────────────────────

/**
 * Get metadata for a Drive file by ID.
 */
export async function getFileById(
  ctx: GoogleWorkspaceContext,
  fileId: string,
): Promise<DriveFile> {
  log.info('Getting Drive file by ID', { fileId, tenantId: ctx.tenantId });
  const token = await getContextToken(ctx, DRIVE_SCOPES);
  const url = new URL(`${DRIVE_API}/files/${fileId}`);
  url.searchParams.set('fields', 'id,name,mimeType,modifiedTime,size,webViewLink,parents');

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive getFileById failed: ${res.status} — ${body}`);
  }
  return toDriveFile(await res.json() as Record<string, unknown>);
}

/**
 * Create a new Google Doc in the user's Drive.
 */
export async function createGoogleDoc(
  ctx: GoogleWorkspaceContext,
  title: string,
  content?: string,
): Promise<DriveFile> {
  log.info('Creating Google Doc', { title, tenantId: ctx.tenantId });

  const token = await getContextToken(ctx, DRIVE_WRITE_SCOPES);

  // Create the file stub in Drive
  const fileRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.document',
    }),
  });

  if (!fileRes.ok) {
    const body = await fileRes.text();
    throw new Error(`Drive createDoc failed: ${fileRes.status} — ${body}`);
  }

  const file = toDriveFile(await fileRes.json() as Record<string, unknown>);

  // If initial content provided, write it via the Docs API
  if (content) {
    const docsToken = await getContextToken(ctx, ['https://www.googleapis.com/auth/documents']);
    const docsRes = await fetch(`${DOCS_API}/documents/${file.id}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${docsToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: 1 }, text: content } }],
      }),
    });
    if (!docsRes.ok) {
      log.warn('Docs API content write failed', { fileId: file.id, status: docsRes.status });
    }
  }

  log.info('Google Doc created', { fileId: file.id, title });
  return file;
}

/**
 * Create a new Google Sheet in the user's Drive.
 */
export async function createGoogleSheet(
  ctx: GoogleWorkspaceContext,
  title: string,
  initialRows?: string[][],
): Promise<DriveFile> {
  log.info('Creating Google Sheet', { title, tenantId: ctx.tenantId });

  const token = await getContextToken(ctx, DRIVE_WRITE_SCOPES);

  const fileRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    }),
  });

  if (!fileRes.ok) {
    const body = await fileRes.text();
    throw new Error(`Drive createSheet failed: ${fileRes.status} — ${body}`);
  }

  const file = toDriveFile(await fileRes.json() as Record<string, unknown>);

  // If initial rows provided, write them via the Sheets API
  if (initialRows?.length) {
    const sheetsToken = await getContextToken(ctx, ['https://www.googleapis.com/auth/spreadsheets']);
    const range = `Sheet1!A1:${String.fromCharCode(64 + (initialRows[0]?.length ?? 1))}${initialRows.length}`;
    const sheetsRes = await fetch(
      `${SHEETS_API}/spreadsheets/${file.id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${sheetsToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range, majorDimension: 'ROWS', values: initialRows }),
      },
    );
    if (!sheetsRes.ok) {
      log.warn('Sheets API write failed', { fileId: file.id, status: sheetsRes.status });
    }
  }

  log.info('Google Sheet created', { fileId: file.id, title });
  return file;
}

// ─── Sheets Read ─────────────────────────────────────────────────────────────

const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

/**
 * Read all rows from a Google Spreadsheet tab via the Sheets API v4.
 *
 * @param ctx            - Google Workspace context (service account, tenant)
 * @param spreadsheetId  - The Sheets file ID (from the URL)
 * @param range          - A1-notation range, e.g. "Sheet1!A:G" or "Contacts!A:H".
 *                         Defaults to the entire first visible sheet ("Sheet1").
 * @returns              - 2-D array of string cell values (rows × columns).
 *                         The first row is typically the header row.
 */
export async function readSheetRows(
  ctx: GoogleWorkspaceContext,
  spreadsheetId: string,
  range = 'Sheet1',
): Promise<string[][]> {
  log.info('Reading sheet rows', { spreadsheetId, range, tenantId: ctx.tenantId });

  const token = await getContextToken(ctx, [SHEETS_READONLY_SCOPE]);
  const url = `${SHEETS_API}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API readRows failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

// ─── Birthday sheet auto-discovery ───────────────────────────────────────────

/** A contact row extracted from a Form response spreadsheet */
export interface SheetBirthdayContact {
  /** Sheet file name — used to infer contact type */
  sheetName: string;
  fileId: string;
  name: string;
  email: string;
  phone: string;
  /** MM-DD normalised */
  birthday: string;
  /** Raw header of the birthday column found */
  birthdayColHeader: string;
}

/** Keywords whose presence in a column header indicates a birthday field */
const BIRTHDAY_HEADER_KEYWORDS = ['birthday', 'birth date', 'date of birth', 'dob', 'born', 'naissance', 'anniversaire'];

/** Detect which column index (0-based) is the birthday column, or -1 */
function detectBirthdayColumn(headers: string[]): { index: number; header: string } {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').toLowerCase().trim();
    if (BIRTHDAY_HEADER_KEYWORDS.some((kw) => h.includes(kw))) {
      return { index: i, header: headers[i] ?? '' };
    }
  }
  return { index: -1, header: '' };
}

/** Detect which column index is a name column, or -1 */
function detectNameColumn(headers: string[]): number {
  const candidates = ['name', 'full name', 'fullname', 'nom', 'prénom', 'prenom', 'first name', 'firstname'];
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').toLowerCase().trim();
    if (candidates.some((c) => h.includes(c))) return i;
  }
  return 0; // fallback to first column
}

/** Detect which column index is an email column, or -1 */
function detectEmailColumn(headers: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').toLowerCase().trim();
    if (h.includes('email') || h.includes('courriel') || h.includes('mail')) return i;
  }
  return -1;
}

/** Detect which column index is a phone column, or -1 */
function detectPhoneColumn(headers: string[]): number {
  const candidates = ['phone', 'telephone', 'téléphone', 'mobile', 'whatsapp', 'tel', 'contact number'];
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').toLowerCase().trim();
    if (candidates.some((c) => h.includes(c))) return i;
  }
  return -1;
}

/**
 * Parse a birthday string into MM-DD format. Accepts:
 *   "MM-DD", "MM/DD", "YYYY-MM-DD", "April 3", "3 April", "3/4/1998", "April 3, 1998"
 */
const MONTH_MAP: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  // French
  janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04',
  mai: '05', juin: '06', juillet: '07', août: '08', aout: '08',
  septembre: '09', octobre: '10', novembre: '11', décembre: '12', decembre: '12',
};

export function parseBirthdayToMMDD(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO: YYYY-MM-DD
  const iso = s.match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
  if (iso?.[1] && iso[2]) return `${iso[1].padStart(2, '0')}-${iso[2].padStart(2, '0')}`;

  // MM-DD or MM/DD (2-segment, no year, month ≤12, day ≤31)
  const mmdd = s.match(/^(\d{1,2})[-\/](\d{1,2})$/);
  if (mmdd?.[1] && mmdd[2]) {
    const m = Number(mmdd[1]), d = Number(mmdd[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // D/M/YYYY or M/D/YYYY or D-M-YYYY (3-segment with year) — treat first two segments as MM-DD
  const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/]\d{2,4}$/);
  if (dmy?.[1] && dmy[2]) {
    const a = Number(dmy[1]), b = Number(dmy[2]);
    // Try MM/DD first (US convention) if a ≤ 12
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) return `${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
  }

  // "April 3" or "April 3, 1998"
  const nameDay = s.match(/^([a-zA-Zéàèûîô]+)\.?\s+(\d{1,2})(,\s*\d{4})?$/);
  if (nameDay?.[1] && nameDay[2]) {
    const month = MONTH_MAP[nameDay[1].toLowerCase()];
    if (month) return `${month}-${nameDay[2].padStart(2, '0')}`;
  }

  // "3 April" or "3 avril 1998"
  const dayName = s.match(/^(\d{1,2})\s+([a-zA-Zéàèûîô]+)(\.?\s*\d{4})?$/);
  if (dayName?.[1] && dayName[2]) {
    const month = MONTH_MAP[dayName[2].toLowerCase()];
    if (month) return `${month}-${dayName[1].padStart(2, '0')}`;
  }

  return null;
}

/**
 * Search all Google Sheets accessible to the service account/impersonated user,
 * read each one, and return contacts whose birthday column matches `filterMMDD`.
 *
 * @param ctx          - Google Workspace context
 * @param filterMMDD   - Today's date in MM-DD, e.g. "04-03"
 * @param maxSheets    - Maximum number of spreadsheets to inspect (default 40)
 */
export async function findSheetsWithBirthdayData(
  ctx: GoogleWorkspaceContext,
  filterMMDD: string,
  maxSheets = 40,
): Promise<SheetBirthdayContact[]> {
  log.info('Scanning Drive sheets for birthday data', { filterMMDD, tenantId: ctx.tenantId });

  // ── 1. Find all spreadsheets (ordered by most recently modified) ──────────
  const sheetsData = await driveGet<{ files: Record<string, unknown>[]; nextPageToken?: string }>(
    ctx,
    '/files',
    {
      q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
      fields: 'files(id,name,modifiedTime,webViewLink)',
      pageSize: String(maxSheets),
      orderBy: 'modifiedTime desc',
    },
  );

  const sheets = sheetsData.files;
  log.info(`Found ${sheets.length} spreadsheet(s) to inspect`, { tenantId: ctx.tenantId });

  const results: SheetBirthdayContact[] = [];
  const token = await getContextToken(ctx, [SHEETS_READONLY_SCOPE]);

  for (const sheet of sheets) {
    const fileId   = sheet.id as string;
    const fileName = sheet.name as string ?? 'Untitled';

    try {
      // ── 2. Read first tab (Sheet1 fallback) via Sheets API ─────────────────
      const sheetMeta = await fetch(
        `${SHEETS_API}/spreadsheets/${fileId}?fields=sheets.properties.title&includeGridData=false`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!sheetMeta.ok) continue;

      const metaData = (await sheetMeta.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
      const firstTabTitle = metaData.sheets?.[0]?.properties?.title ?? 'Sheet1';

      // Read up to 500 rows from the first tab
      const range = `${firstTabTitle}!A1:Z500`;
      const rowsRes = await fetch(
        `${SHEETS_API}/spreadsheets/${fileId}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!rowsRes.ok) continue;

      const rowsData = (await rowsRes.json()) as { values?: string[][] };
      const rows = rowsData.values ?? [];
      if (rows.length < 2) continue;

      const headerRow = rows[0] ?? [];

      // ── 3. Detect birthday column ──────────────────────────────────────────
      const { index: bdayIdx, header: bdayHeader } = detectBirthdayColumn(headerRow);
      if (bdayIdx === -1) continue; // this sheet has no birthday column

      const nameIdx  = detectNameColumn(headerRow);
      const emailIdx = detectEmailColumn(headerRow);
      const phoneIdx = detectPhoneColumn(headerRow);

      log.info(`Sheet "${fileName}" has birthday column "${bdayHeader}" at index ${bdayIdx}`, {
        fileId, tenantId: ctx.tenantId,
      });

      // ── 4. Scan rows for today's birthday ─────────────────────────────────
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const rawBday = row[bdayIdx]?.trim() ?? '';
        if (!rawBday) continue;

        const mmdd = parseBirthdayToMMDD(rawBday);
        if (mmdd !== filterMMDD) continue;

        results.push({
          sheetName: fileName,
          fileId,
          name:  row[nameIdx]?.trim() ?? `Row ${r + 1}`,
          email: emailIdx >= 0 ? (row[emailIdx]?.trim() ?? '') : '',
          phone: phoneIdx >= 0 ? (row[phoneIdx]?.trim() ?? '') : '',
          birthday: mmdd,
          birthdayColHeader: bdayHeader,
        });
      }
    } catch (err) {
      log.warn(`Failed to read sheet "${fileName}"`, {
        fileId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.info(`Found ${results.length} birthday match(es) across ${sheets.length} sheet(s)`, {
    tenantId: ctx.tenantId,
  });
  return results;
}

export type DriveShareRole = 'reader' | 'commenter' | 'writer' | 'fileOrganizer';

/**
 * Share a Drive file or folder with a specific user.
 */
export async function shareFile(
  ctx: GoogleWorkspaceContext,
  fileId: string,
  email: string,
  role: DriveShareRole = 'reader',
  sendNotification = true,
): Promise<{ permissionId: string; email: string; role: string }> {
  log.info('Sharing Drive file', { fileId, email, role, tenantId: ctx.tenantId });

  const token = await getContextToken(ctx, DRIVE_WRITE_SCOPES);
  const url = new URL(`${DRIVE_API}/files/${fileId}/permissions`);
  if (!sendNotification) url.searchParams.set('sendNotificationEmail', 'false');

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'user', role, emailAddress: email }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive shareFile failed: ${res.status} — ${body}`);
  }

  const data = await res.json() as { id: string; emailAddress: string; role: string };
  log.info('File shared', { fileId, permissionId: data.id, email, role });
  return { permissionId: data.id, email: data.emailAddress ?? email, role: data.role ?? role };
}
