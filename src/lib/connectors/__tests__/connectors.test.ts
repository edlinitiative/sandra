import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies
vi.mock('@/lib/github', () => ({
  getGitHubClient: () => ({
    healthCheck: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: { count: vi.fn().mockResolvedValue(5) },
    session: { count: vi.fn().mockResolvedValue(10) },
    repoRegistry: { count: vi.fn().mockResolvedValue(4) },
  },
}));

vi.mock('@/lib/config', () => ({
  env: {
    GITHUB_TOKEN: 'test-token-for-github',
    OPENAI_API_KEY: 'sk-test-key-for-openai-1234567890',
    OPENAI_MODEL: 'gpt-4o',
    OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
  },
}));

// Dynamically import connectors after mocks are set
const { connectorRegistry, getConnectorRegistry } = await import('../types');
const { GitHubConnector } = await import('../github-connector');
const { DatabaseConnector } = await import('../database-connector');
const { OpenAIConnector } = await import('../openai-connector');
const { AcademyConnector } = await import('../academy-connector');
const { CodeConnector } = await import('../code-connector');
const { NewsConnector } = await import('../news-connector');
const { InitiativeConnector } = await import('../initiative-connector');

describe('Connector Framework', () => {
  beforeEach(() => {
    connectorRegistry.clear();
  });

  // ─── ConnectorRegistry ────────────────────────────────────────────────

  describe('ConnectorRegistry', () => {
    it('should register and retrieve connectors', () => {
      const connector = new AcademyConnector();
      connectorRegistry.register(connector);
      expect(connectorRegistry.has('edlight-academy')).toBe(true);
      expect(connectorRegistry.get('edlight-academy')).toBe(connector);
    });

    it('should list all registered connectors', () => {
      connectorRegistry.register(new AcademyConnector());
      connectorRegistry.register(new CodeConnector());
      expect(connectorRegistry.getAll()).toHaveLength(2);
    });

    it('should allow re-registration (replace)', () => {
      connectorRegistry.register(new AcademyConnector());
      connectorRegistry.register(new AcademyConnector()); // Should not throw
      expect(connectorRegistry.getAll()).toHaveLength(1);
    });

    it('should run health checks on all connectors', async () => {
      connectorRegistry.register(new AcademyConnector());
      connectorRegistry.register(new CodeConnector());

      const health = await connectorRegistry.healthCheckAll();
      expect(health).toHaveProperty('edlight-academy');
      expect(health).toHaveProperty('edlight-code');
      expect(health['edlight-academy']!.status).toBe('connected');
    });

    it('should list connector info with metadata', async () => {
      connectorRegistry.register(new AcademyConnector());
      const infos = await connectorRegistry.listConnectors();
      expect(infos).toHaveLength(1);
      expect(infos[0]!.id).toBe('edlight-academy');
      expect(infos[0]!.name).toBe('EdLight Academy');
      expect(infos[0]!.capabilities).toContain('course-catalog');
    });

    it('should clear all connectors', () => {
      connectorRegistry.register(new AcademyConnector());
      connectorRegistry.clear();
      expect(connectorRegistry.getAll()).toHaveLength(0);
    });
  });

  // ─── Individual Connectors ────────────────────────────────────────────

  describe('GitHubConnector', () => {
    it('should report configured when token exists', () => {
      const connector = new GitHubConnector();
      expect(connector.isConfigured()).toBe(true);
    });

    it('should have correct capabilities', () => {
      const connector = new GitHubConnector();
      expect(connector.capabilities).toContain('docs-indexing');
      expect(connector.capabilities).toContain('repo-listing');
    });

    it('should perform health check', async () => {
      const connector = new GitHubConnector();
      const health = await connector.healthCheck();
      expect(health.status).toBe('connected');
      expect(health.lastChecked).toBeInstanceOf(Date);
    });
  });

  describe('DatabaseConnector', () => {
    it('should report configured when DATABASE_URL exists', () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      const connector = new DatabaseConnector();
      expect(connector.isConfigured()).toBe(true);
      if (originalUrl) {
        process.env.DATABASE_URL = originalUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    });

    it('should have user-records capability', () => {
      const connector = new DatabaseConnector();
      expect(connector.capabilities).toContain('user-records');
      expect(connector.capabilities).toContain('vector-search');
    });
  });

  describe('OpenAIConnector', () => {
    it('should report configured when API key is valid', () => {
      const connector = new OpenAIConnector();
      expect(connector.isConfigured()).toBe(true);
    });

    it('should have streaming capability', () => {
      const connector = new OpenAIConnector();
      expect(connector.capabilities).toContain('streaming');
      expect(connector.capabilities).toContain('tool-calling');
    });
  });

  describe('AcademyConnector', () => {
    it('should always be configured', () => {
      expect(new AcademyConnector().isConfigured()).toBe(true);
    });

    it('should report healthy', async () => {
      const health = await new AcademyConnector().healthCheck();
      expect(health.status).toBe('connected');
    });

    it('should have correct platform', () => {
      expect(new AcademyConnector().platform).toBe('edlight-academy');
    });
  });

  describe('CodeConnector', () => {
    it('should have correct metadata', async () => {
      const info = await new CodeConnector().getInfo();
      expect(info.id).toBe('edlight-code');
      expect(info.capabilities).toContain('project-catalog');
    });
  });

  describe('NewsConnector', () => {
    it('should have news-feed capability', () => {
      const connector = new NewsConnector();
      expect(connector.capabilities).toContain('news-feed');
      expect(connector.id).toBe('edlight-news');
    });
  });

  describe('InitiativeConnector', () => {
    it('should have programs and scholarships capabilities', () => {
      const connector = new InitiativeConnector();
      expect(connector.capabilities).toContain('programs');
      expect(connector.capabilities).toContain('scholarships');
    });
  });

  // ─── Default Registration ─────────────────────────────────────────────

  describe('Default connector registration', () => {
    it('should register all 7 default connectors on import', async () => {
      // Import the index module which triggers registration
      const { connectorRegistry: freshRegistry } = await import('../index');
      const all = freshRegistry.getAll();
      expect(all.length).toBeGreaterThanOrEqual(7);
    });
  });
});
