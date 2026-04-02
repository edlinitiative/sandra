/**
 * Google Workspace integration — type definitions.
 *
 * Platform-agnostic interfaces that could apply to any workspace provider
 * (Google, Microsoft 365, etc.), plus Google-specific sub-types.
 */

// ─── Provider-Agnostic ──────────────────────────────────────────────────────

/** Credentials stored in ConnectedProvider.credentials (encrypted at rest). */
export interface GoogleServiceAccountCredentials {
  type: 'service_account';
  client_email: string;
  private_key: string;
  project_id?: string;
  token_uri?: string;
}

/** Configuration stored in ConnectedProvider.config. */
export interface GoogleWorkspaceConfig {
  /** Workspace domain (e.g. "edlight.org") */
  domain: string;
  /** Admin email for domain-wide delegation (impersonation anchor) */
  adminEmail: string;
  /** Super Admin email for Admin SDK / Directory API (requires Workspace Super Admin role) */
  directoryAdminEmail?: string;
  /** Email to impersonate for Drive access (if docs live under a shared account like info@) */
  driveImpersonateEmail?: string;
  /** Drive folder IDs to index for knowledge */
  driveFolderIds?: string[];
  /** Scopes granted via domain-wide delegation */
  grantedScopes?: string[];
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface GoogleAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  /** Epoch ms when this token was obtained */
  obtained_at: number;
}

// ─── Drive ───────────────────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  /** Full path within the drive hierarchy (e.g. "Knowledge/Policies/handbook.pdf") */
  path?: string;
  modifiedTime?: string;
  size?: number;
  webViewLink?: string;
  parents?: string[];
}

export interface DriveFileContent {
  file: DriveFile;
  /** Extracted text content */
  text: string;
  /** How content was extracted */
  extractionMethod: 'export' | 'download' | 'description_only';
}

export interface DriveSearchOptions {
  /** Folder IDs to search within (recursive) */
  folderIds?: string[];
  /** File name or content query (Google Drive search syntax) */
  query?: string;
  /** Filter by MIME type */
  mimeType?: string;
  /** Maximum results */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
}

export interface DriveSearchResult {
  files: DriveFile[];
  nextPageToken?: string;
  totalCount?: number;
}

// ─── Gmail ───────────────────────────────────────────────────────────────────

export interface GmailDraftInput {
  /** Sender email (must be a domain user for impersonation) */
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  /** If true, body is HTML; otherwise plain text */
  isHtml?: boolean;
}

export interface GmailSendResult {
  messageId: string;
  threadId: string;
  labelIds: string[];
}

// ─── Directory ───────────────────────────────────────────────────────────────

export interface DirectoryUser {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  department?: string;
  title?: string;
  phone?: string;
  photoUrl?: string;
  isAdmin?: boolean;
  suspended?: boolean;
}

export interface DirectorySearchOptions {
  query?: string;
  department?: string;
  maxResults?: number;
  pageToken?: string;
}

export interface DirectorySearchResult {
  users: DirectoryUser[];
  nextPageToken?: string;
}

// ─── Tenant Context ──────────────────────────────────────────────────────────

/**
 * Runtime context for a Google Workspace operation.
 * Resolved from the ConnectedProvider + TenantMember at call time.
 */
export interface GoogleWorkspaceContext {
  tenantId: string;
  providerId: string;
  credentials: GoogleServiceAccountCredentials;
  config: GoogleWorkspaceConfig;
  /** The user email to impersonate for this request (domain-wide delegation) */
  impersonateEmail?: string;
}
