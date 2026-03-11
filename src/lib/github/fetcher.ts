import { getGitHubClient } from './client';
import type { RepoConfig, GitHubFile } from './types';
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

    for (const item of items) {
      if (item.type === 'dir' && recursive) {
        await fetchDirectory(client, repo, item.path, files, errors, true);
      } else if (item.type === 'file' && isIndexable(item.name, item.size)) {
        try {
          const file = await client.getFileContent(repo.owner, repo.name, item.path, repo.branch);
          files.push(file);
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
