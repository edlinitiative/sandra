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

/** Result of an indexing operation */
export interface IndexingResult {
  repoFullName: string;
  filesIndexed: number;
  chunksCreated: number;
  errors: string[];
  duration: number;
}
