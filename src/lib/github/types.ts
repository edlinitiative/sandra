/**
 * GitHub integration type definitions.
 */

/** Configuration for a registered EdLight repository */
export interface RepoConfig {
  owner: string;
  name: string;
  displayName: string;
  description: string;
  url: string;
  branch: string;
  docsPath?: string;
  isActive: boolean;
}

/** A file fetched from a GitHub repository */
export interface GitHubFile {
  path: string;
  name: string;
  content: string;
  sha: string;
  size: number;
  url: string;
}

/** A markdown document fetched from a repository (simplified view for indexing) */
export interface FetchedDocument {
  path: string;
  content: string;
  url: string;
}

/** Result of an indexing operation */
export interface IndexingResult {
  repoId: string;
  repoFullName: string;
  status: 'completed' | 'failed';
  documentsProcessed: number;
  documentsSkipped: number;
  documentsFailed: number;
  startedAt: Date;
  completedAt: Date;
  error?: string;
  /** Kept for backward compat */
  filesIndexed: number;
  chunksCreated: number;
  errors: string[];
  duration: number;
}
