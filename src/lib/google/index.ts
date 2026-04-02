/**
 * Google Workspace — barrel exports.
 */

// Types
export type {
  GoogleServiceAccountCredentials,
  GoogleWorkspaceConfig,
  GoogleAccessToken,
  GoogleWorkspaceContext,
  DriveFile,
  DriveFileContent,
  DriveSearchOptions,
  DriveSearchResult,
  GmailDraftInput,
  GmailSendResult,
  DirectoryUser,
  DirectorySearchOptions,
  DirectorySearchResult,
} from './types';

// Auth
export {
  getAccessToken,
  getContextToken,
  validateCredentials,
  clearTokenCache,
  GOOGLE_SCOPES,
} from './auth';

// Drive
export {
  listFolder,
  listFolderRecursive,
  searchFiles,
  getFileContent,
  getFilesContent,
} from './drive';

// Gmail
export { sendEmail, createDraft } from './gmail';

// Directory
export { listUsers, getUserByEmail } from './directory';

// Context resolver
export { resolveGoogleContext, resolveTenantForUser, getTenantRole } from './context';

// Drive indexer (knowledge pipeline integration)
export { indexDriveFiles } from './drive-indexer';
export type { DriveIndexOptions, DriveIndexResult } from './drive-indexer';
