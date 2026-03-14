import type { RepoConfig } from './types';

/**
 * Default EdLight repository registry.
 * New initiatives can be added here or registered dynamically via the admin API.
 */
export const DEFAULT_REPOS: RepoConfig[] = [
  {
    owner: 'edlinitiative',
    name: 'code',
    displayName: 'EdLight Code',
    description: 'The core EdLight codebase and platform.',
    url: 'https://github.com/edlinitiative/code',
    branch: 'main',
    docsPath: 'docs/',
    isActive: true,
  },
  {
    owner: 'edlinitiative',
    name: 'EdLight-News',
    displayName: 'EdLight News',
    description: 'News and updates platform for the EdLight community.',
    url: 'https://github.com/edlinitiative/EdLight-News',
    branch: 'main',
    isActive: true,
  },
  {
    owner: 'edlinitiative',
    name: 'EdLight-Initiative',
    displayName: 'EdLight Initiative',
    description: 'The EdLight Initiative organization and community hub.',
    url: 'https://github.com/edlinitiative/EdLight-Initiative',
    branch: 'main',
    isActive: true,
  },
  {
    owner: 'edlinitiative',
    name: 'EdLight-Academy',
    displayName: 'EdLight Academy',
    description: 'Educational platform and learning resources for the EdLight ecosystem.',
    url: 'https://github.com/edlinitiative/EdLight-Academy',
    branch: 'main',
    docsPath: 'docs/',
    isActive: true,
  },
];

/**
 * Get all configured repos (active only by default).
 */
export function getConfiguredRepos(includeInactive = false): RepoConfig[] {
  if (includeInactive) return DEFAULT_REPOS;
  return DEFAULT_REPOS.filter((r) => r.isActive);
}

/**
 * Find a repo config by repoId.
 * Accepts "owner/name", "name", or bare name.
 */
export function findRepoConfig(repoId: string): RepoConfig | undefined {
  const parts = repoId.split('/');
  if (parts.length === 2) {
    const [owner, name] = parts;
    return DEFAULT_REPOS.find((r) => r.owner === owner && r.name === name);
  }
  return DEFAULT_REPOS.find((r) => r.name === repoId);
}
