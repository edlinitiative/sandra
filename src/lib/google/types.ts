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

// ─── Google Forms ─────────────────────────────────────────────────────────────

export type FormQuestionType =
  | 'short_answer'
  | 'paragraph'
  | 'multiple_choice'
  | 'checkbox'
  | 'dropdown'
  | 'date'
  | 'section_header';

export interface FormQuestionItem {
  /** Question prompt / section title */
  title: string;
  /** Optional helper text shown below the title */
  description?: string;
  type: FormQuestionType;
  /** Whether a response is required. Default false. */
  required?: boolean;
  /** Choices for multiple_choice, checkbox, dropdown */
  options?: string[];
}

export interface FormInput {
  title: string;
  description?: string;
  questions: FormQuestionItem[];
}

export interface FormResult {
  formId: string;
  title: string;
  description?: string;
  /** Public link respondents use to fill in the form */
  responderUri: string;
  /** Editor link (owner only) */
  editUrl: string;
  questionCount: number;
}

export interface FormResponse {
  responseId: string;
  submittedAt: string;
  respondentEmail?: string;
  /** Map of question title → answer text (or array for multi-select) */
  answers: Record<string, string | string[]>;
}

export interface FormResponsesResult {
  formId: string;
  formTitle: string;
  totalResponses: number;
  responses: FormResponse[];
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
