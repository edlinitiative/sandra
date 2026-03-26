import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Mock the DB
vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: { count: vi.fn().mockResolvedValue(3) },
    session: { count: vi.fn().mockResolvedValue(10) },
    repoRegistry: {
      findMany: vi.fn().mockResolvedValue([
        { id: '1', owner: 'edlinitiative', name: 'code', displayName: 'EdLight Code', syncStatus: 'indexed', lastSyncAt: new Date() },
        { id: '2', owner: 'edlinitiative', name: 'EdLight-Academy', displayName: 'EdLight Academy', syncStatus: 'indexed', lastSyncAt: new Date() },
      ]),
      count: vi.fn().mockResolvedValue(4),
    },
    indexedSource: {
      findMany: vi.fn().mockResolvedValue([
        { owner: 'edlinitiative', repo: 'code', documentCount: 50, lastIndexedAt: new Date() },
        { owner: 'edlinitiative', repo: 'EdLight-Academy', documentCount: 80, lastIndexedAt: new Date() },
      ]),
    },
    indexedDocument: { count: vi.fn().mockResolvedValue(200) },
  },
  getActiveRepos: vi.fn().mockResolvedValue([
    { id: '1', owner: 'edlinitiative', name: 'code' },
  ]),
  getRepoByRepoId: vi.fn().mockResolvedValue({ id: '1', owner: 'edlinitiative', name: 'code' }),
}));

vi.mock('@/lib/knowledge', () => ({
  getVectorStore: () => ({
    count: vi.fn().mockResolvedValue(150),
  }),
}));

vi.mock('@/lib/github', () => ({
  indexAllRepositories: vi.fn().mockResolvedValue([
    {
      repoId: '1',
      repoFullName: 'edlinitiative/code',
      status: 'completed',
      documentsProcessed: 50,
      documentsSkipped: 0,
      documentsFailed: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      filesIndexed: 10,
      chunksCreated: 50,
      errors: [],
      duration: 1200,
    },
  ]),
  indexRepositoriesByConfig: vi.fn().mockResolvedValue([]),
  getConfiguredRepos: vi.fn().mockReturnValue([
    { owner: 'edlinitiative', name: 'code', displayName: 'EdLight Code' },
    { owner: 'edlinitiative', name: 'EdLight-Academy', displayName: 'EdLight Academy' },
  ]),
  getGitHubClient: () => ({
    healthCheck: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('@/lib/config', () => ({
  env: {
    GITHUB_TOKEN: 'test-token',
    OPENAI_API_KEY: 'sk-test-key-openai-valid-1234567890',
    OPENAI_MODEL: 'gpt-4o',
    OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
  },
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/connectors', () => ({
  getConnectorRegistry: () => ({
    listConnectors: vi.fn().mockResolvedValue([
      {
        id: 'github',
        name: 'GitHub',
        description: 'GitHub connector',
        platform: 'github',
        version: '1.0.0',
        capabilities: ['repo-listing'],
        health: { status: 'connected', lastChecked: new Date(), latencyMs: 50 },
      },
      {
        id: 'database',
        name: 'Sandra Database',
        description: 'PostgreSQL',
        platform: 'postgresql',
        version: '1.0.0',
        capabilities: ['user-records'],
        health: { status: 'connected', lastChecked: new Date(), latencyMs: 3 },
      },
    ]),
    healthCheckAll: vi.fn().mockResolvedValue({
      github: { status: 'connected', lastChecked: new Date(), latencyMs: 50 },
      database: { status: 'connected', lastChecked: new Date(), latencyMs: 3 },
    }),
  }),
}));

// Import tool registry after mocks
import { toolRegistry } from '../../tools/registry';

// Import all admin tools to trigger registration
import '@/lib/tools/trigger-indexing';
import '@/lib/tools/get-indexing-status';
import '@/lib/tools/list-connected-systems';
import '@/lib/tools/view-system-health';

describe('Admin Tools', () => {
  // ─── triggerRepoIndexing ──────────────────────────────────────────────

  describe('triggerRepoIndexing', () => {
    it('should be registered with admin:tools scope', async () => {
      const tool = toolRegistry.get('triggerRepoIndexing');
      expect(tool).toBeDefined();
      expect(tool!.requiredScopes).toContain('admin:tools');
    });

    it('should trigger indexing for a specific repo', async () => {
      const tool = toolRegistry.get('triggerRepoIndexing')!;
      const result = await tool.handler(
        { repoId: 'edlinitiative/code' },
        { sessionId: 'test', scopes: ['admin:tools'] },
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('summary');
    });

    it('should trigger indexing for all repos when no repoId given', async () => {
      const tool = toolRegistry.get('triggerRepoIndexing')!;
      const result = await tool.handler(
        {},
        { sessionId: 'test', scopes: ['admin:tools'] },
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── getIndexingStatus ────────────────────────────────────────────────

  describe('getIndexingStatus', () => {
    it('should be registered with admin:tools scope', async () => {
      const tool = toolRegistry.get('getIndexingStatus');
      expect(tool).toBeDefined();
      expect(tool!.requiredScopes).toContain('admin:tools');
    });

    it('should return repo statuses and summary', async () => {
      const tool = toolRegistry.get('getIndexingStatus')!;
      const result = await tool.handler(
        {},
        { sessionId: 'test', scopes: ['admin:tools'] },
      );
      expect(result.success).toBe(true);
      const data = result.data as { repos: unknown[]; summary: { totalRepos: number } };
      expect(data.repos).toHaveLength(2);
      expect(data.summary.totalRepos).toBe(2);
    });
  });

  // ─── listConnectedSystems ─────────────────────────────────────────────

  describe('listConnectedSystems', () => {
    it('should be registered with admin:tools scope', async () => {
      const tool = toolRegistry.get('listConnectedSystems');
      expect(tool).toBeDefined();
      expect(tool!.requiredScopes).toContain('admin:tools');
    });

    it('should list connected systems with health', async () => {
      const tool = toolRegistry.get('listConnectedSystems')!;
      const result = await tool.handler(
        {},
        { sessionId: 'test', scopes: ['admin:tools'] },
      );
      expect(result.success).toBe(true);
      const data = result.data as { systems: unknown[]; summary: { total: number; connected: number } };
      expect(data.systems).toHaveLength(2);
      expect(data.summary.connected).toBe(2);
    });
  });

  // ─── viewSystemHealth ─────────────────────────────────────────────────

  describe('viewSystemHealth', () => {
    it('should be registered with admin:tools scope', async () => {
      const tool = toolRegistry.get('viewSystemHealth');
      expect(tool).toBeDefined();
      expect(tool!.requiredScopes).toContain('admin:tools');
    });

    it('should return comprehensive health data', async () => {
      const tool = toolRegistry.get('viewSystemHealth')!;
      const result = await tool.handler(
        {},
        { sessionId: 'test', scopes: ['admin:tools'] },
      );
      expect(result.success).toBe(true);
      const data = result.data as {
        status: string;
        uptimeMinutes: number;
        database: { status: string };
        tools: { total: number };
        memory: { rss: number };
      };
      expect(data.status).toBe('healthy');
      expect(data.uptimeMinutes).toBeGreaterThanOrEqual(0);
      expect(data.database.status).toBe('ok');
      expect(data.tools.total).toBeGreaterThan(0);
      expect(data.memory.rss).toBeGreaterThan(0);
    });
  });
});
