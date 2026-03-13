export type { RepoConfig, GitHubFile, FetchedDocument, IndexingResult } from './types';
export { DEFAULT_REPOS, getConfiguredRepos, findRepoConfig } from './config';
export { GitHubClient, getGitHubClient } from './client';
export { fetchRepoContent, fetchRepoDocuments } from './fetcher';
export {
  indexRepository,
  indexAllRepositories,
  indexRepositoriesByConfig,
  getIndexingResult,
  computeContentHash,
  hasContentChanged,
} from './indexer';
