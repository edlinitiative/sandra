import { getGitHubClient } from './client';
import type { RepoConfig, GitHubFile, FetchedDocument } from './types';
import { createLogger } from '@/lib/utils';

const log = createLogger('github:fetcher');

/** File extensions we consider indexable text content */
const INDEXABLE_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.rst',
  '.json', '.yaml', '.yml', '.toml',
  '.ts', '.tsx', '.js', '.jsx',
  '.py', '.rb', '.go', '.rs',
  '.html', '.css', '.scss',
]);

/** Markdown-only extensions for fetchRepoDocuments */
const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);

const MAX_FILE_SIZE = 100_000; // 100KB max per file

/**
 * Fetch all indexable files from a repository.
 * Recursively traverses the repo tree and returns text content.
 */
export async function fetchRepoContent(repo: RepoConfig): Promise<GitHubFile[]> {
  const client = getGitHubClient();
  const files: GitHubFile[] = [];
  const errors: string[] = [];

  log.info(`Fetching content from ${repo.owner}/${repo.name}`);

  // Always try to get README
  const readme = await client.getReadme(repo.owner, repo.name);
  if (readme) {
    files.push(readme);
  }

  // If docs path is specified, fetch from there
  if (repo.docsPath) {
    await fetchDirectory(client, repo, repo.docsPath, files, errors);
  }

  // Also fetch top-level markdown files
  await fetchDirectory(client, repo, '', files, errors, false);

  if (errors.length > 0) {
    log.warn(`Encountered ${errors.length} errors fetching ${repo.owner}/${repo.name}`, { errors });
  }

  // Deduplicate by path
  const seen = new Set<string>();
  const unique = files.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });

  log.info(`Fetched ${unique.length} files from ${repo.owner}/${repo.name}`);
  return unique;
}

/**
 * Fetch only markdown documents from a repository.
 * Returns FetchedDocument[] (simplified, with URL).
 * Fetches README + all .md files from docsPath.
 */
export async function fetchRepoDocuments(repo: RepoConfig): Promise<FetchedDocument[]> {
  const client = getGitHubClient();
  const documents: FetchedDocument[] = [];
  const seen = new Set<string>();

  log.info(`Fetching documents from ${repo.owner}/${repo.name}`);

  // Always try to get README
  const readme = await client.getReadme(repo.owner, repo.name);
  if (readme && !seen.has(readme.path)) {
    seen.add(readme.path);
    documents.push({
      path: readme.path,
      content: readme.content,
      url: readme.url,
    });
  }

  // Fetch .md files from docsPath (or root if no docsPath)
  const docsPath = repo.docsPath ?? '';
  const items = await client.listDirectory(repo.owner, repo.name, docsPath, repo.branch);

  if (items === null) {
    log.warn(`Docs path not found: ${repo.owner}/${repo.name}/${docsPath}`);
  } else {
    for (const item of items) {
      if (item.type !== 'file') continue;
      const ext = '.' + item.name.split('.').pop()?.toLowerCase();
      if (!MARKDOWN_EXTENSIONS.has(ext)) continue;
      if (item.size > MAX_FILE_SIZE) continue;
      if (seen.has(item.path)) continue;

      try {
        const file = await client.getFileContent(repo.owner, repo.name, item.path, repo.branch);
        if (file) {
          seen.add(file.path);
          documents.push({
            path: file.path,
            content: file.content,
            url: file.url,
          });
        }
      } catch (e) {
        log.warn(`Failed to fetch ${item.path}`, {
          error: e instanceof Error ? e.message : 'unknown',
        });
      }
    }
  }

  log.info(`Fetched ${documents.length} documents from ${repo.owner}/${repo.name}`);
  return documents;
}

async function fetchDirectory(
  client: ReturnType<typeof getGitHubClient>,
  repo: RepoConfig,
  path: string,
  files: GitHubFile[],
  errors: string[],
  recursive = true,
): Promise<void> {
  try {
    const items = await client.listDirectory(repo.owner, repo.name, path, repo.branch);

    if (items === null) {
      log.debug(`Directory not found, skipping: ${path}`);
      return;
    }

    for (const item of items) {
      if (item.type === 'dir' && recursive) {
        await fetchDirectory(client, repo, item.path, files, errors, true);
      } else if (item.type === 'file' && isIndexable(item.name, item.size)) {
        try {
          const file = await client.getFileContent(repo.owner, repo.name, item.path, repo.branch);
          if (file) {
            files.push(file);
          }
        } catch (e) {
          errors.push(`Failed to fetch ${item.path}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }
    }
  } catch (e) {
    errors.push(`Failed to list ${path}: ${e instanceof Error ? e.message : 'unknown'}`);
  }
}

function isIndexable(filename: string, size: number): boolean {
  if (size > MAX_FILE_SIZE) return false;
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return INDEXABLE_EXTENSIONS.has(ext);
}
