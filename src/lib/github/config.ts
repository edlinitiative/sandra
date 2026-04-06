import type { RepoConfig } from './types';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/utils';

const log = createLogger('github:config');

/** @seed Default repos for the seed tenant. Other tenants configure repos via RepoRegistry in the database. */
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
 * Load repos from the database for a specific tenant.
 * Falls back to DEFAULT_REPOS when the tenant has no DB rows.
 */
export async function getTenantRepos(tenantId: string): Promise<RepoConfig[]> {
  try {
    const rows = await db.repoRegistry.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (rows.length === 0) {
      log.debug(`No DB repos for tenant ${tenantId}, falling back to DEFAULT_REPOS`);
      return DEFAULT_REPOS.filter((r) => r.isActive);
    }

    return rows.map((r) => ({
      owner: r.owner,
      name: r.name,
      displayName: r.displayName,
      description: r.description ?? '',
      url: r.url,
      branch: r.branch,
      docsPath: r.docsPath ?? undefined,
      isActive: r.isActive,
    }));
  } catch (error) {
    log.warn('Failed to load tenant repos from DB, falling back to DEFAULT_REPOS', {
      tenantId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return DEFAULT_REPOS.filter((r) => r.isActive);
  }
}

/**
 * Get all configured repos (active only by default).
 * When a tenantId is provided, loads repos from the database first.
 */
export function getConfiguredRepos(includeInactive?: boolean): RepoConfig[];
export function getConfiguredRepos(includeInactive: boolean | undefined, tenantId: string): Promise<RepoConfig[]>;
export function getConfiguredRepos(includeInactive?: boolean, tenantId?: string): RepoConfig[] | Promise<RepoConfig[]> {
  if (tenantId) {
    return getTenantRepos(tenantId);
  }
  if (includeInactive) return DEFAULT_REPOS;
  return DEFAULT_REPOS.filter((r) => r.isActive);
}

/**
 * Find a repo config by repoId.
 * Accepts "owner/name", "name", or bare name.
 * When a tenantId is provided, also searches tenant repos from the database.
 */
export async function findRepoConfig(repoId: string, tenantId?: string): Promise<RepoConfig | undefined> {
  // Search DEFAULT_REPOS first (fast, synchronous)
  const parts = repoId.split('/');
  let found: RepoConfig | undefined;
  if (parts.length === 2) {
    const [owner, name] = parts;
    found = DEFAULT_REPOS.find((r) => r.owner === owner && r.name === name);
  } else {
    found = DEFAULT_REPOS.find((r) => r.name === repoId);
  }
  if (found) return found;

  // Search tenant DB repos if tenantId provided
  if (tenantId) {
    const tenantRepos = await getTenantRepos(tenantId);
    if (parts.length === 2) {
      const [owner, name] = parts;
      return tenantRepos.find((r) => r.owner === owner && r.name === name);
    }
    return tenantRepos.find((r) => r.name === repoId);
  }

  return undefined;
}
