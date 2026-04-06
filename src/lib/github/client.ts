import { env } from '@/lib/config';
import { createLogger, ProviderError } from '@/lib/utils';
import type { GitHubFile } from './types';

const log = createLogger('github:client');

const GITHUB_API = 'https://api.github.com';

interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  download_url: string | null;
  html_url: string;
}

/**
 * Low-level GitHub API client.
 * Handles authentication, rate limiting, and content fetching.
 */
export class GitHubClient {
  private token: string;
  private headers: Record<string, string>;

  constructor(token?: string) {
    this.token = token ?? env.GITHUB_TOKEN;
    this.headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Sandra-AI-Agent',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  /**
   * Fetch a list of files from a repository directory.
   * Returns null if the path does not exist (404).
   */
  async listDirectory(owner: string, repo: string, path = '', branch = 'main'): Promise<GitHubContentItem[] | null> {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    log.debug(`Listing directory: ${owner}/${repo}/${path}`);

    const response = await fetch(url, { headers: this.headers });

    if (response.status === 404) {
      log.debug(`Directory not found: ${owner}/${repo}/${path}`);
      return null;
    }

    if (response.status === 403) {
      const retryAfter = response.headers.get('X-RateLimit-Reset');
      throw new ProviderError(
        'github',
        `GitHub rate limit exceeded${retryAfter ? ` — retry after ${retryAfter}` : ''}`,
      );
    }

    if (!response.ok) {
      throw new ProviderError('github', `Failed to list ${owner}/${repo}/${path}: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Fetch the content of a single file.
   * Returns null if the file does not exist (404).
   */
  async getFileContent(owner: string, repo: string, path: string, branch = 'main'): Promise<GitHubFile | null> {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    log.debug(`Fetching file: ${owner}/${repo}/${path}`);

    const response = await fetch(url, { headers: this.headers });

    if (response.status === 404) {
      log.debug(`File not found: ${owner}/${repo}/${path}`);
      return null;
    }

    if (response.status === 403) {
      const retryAfter = response.headers.get('X-RateLimit-Reset');
      throw new ProviderError(
        'github',
        `GitHub rate limit exceeded${retryAfter ? ` — retry after ${retryAfter}` : ''}`,
      );
    }

    if (!response.ok) {
      throw new ProviderError('github', `Failed to fetch ${owner}/${repo}/${path}: ${response.status}`);
    }

    const data = await response.json();

    // Decode base64 content
    const content = data.content
      ? Buffer.from(data.content, 'base64').toString('utf-8')
      : '';

    return {
      path: data.path,
      name: data.name,
      content,
      sha: data.sha,
      size: data.size,
      url: data.html_url,
    };
  }

  /**
   * Alias for getFileContent — for compatibility with phase doc naming.
   */
  async getRepoContents(owner: string, repo: string, path: string, branch = 'main'): Promise<GitHubContentItem[] | null> {
    return this.listDirectory(owner, repo, path, branch);
  }

  /**
   * Fetch README from a repository.
   */
  async getReadme(owner: string, repo: string): Promise<GitHubFile | null> {
    try {
      const url = `${GITHUB_API}/repos/${owner}/${repo}/readme`;
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) return null;

      const data = await response.json();
      const content = data.content
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : '';

      return {
        path: data.path,
        name: data.name,
        content,
        sha: data.sha,
        size: data.size,
        url: data.html_url,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get basic repository metadata.
   */
  async getRepoInfo(owner: string, repo: string): Promise<Record<string, unknown> | null> {
    try {
      const url = `${GITHUB_API}/repos/${owner}/${repo}`;
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Check if the GitHub token is valid and the API is reachable.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${GITHUB_API}/rate_limit`, { headers: this.headers });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton (used when no token override is provided)
let client: GitHubClient | null = null;

/**
 * Get a GitHubClient instance.
 * If a token is provided, a fresh (non-cached) instance is returned.
 * Without a token the module-level singleton is used (falls back to env.GITHUB_TOKEN).
 */
export function getGitHubClient(token?: string): GitHubClient {
  if (token) {
    return new GitHubClient(token);
  }
  if (!client) {
    client = new GitHubClient();
  }
  return client;
}
