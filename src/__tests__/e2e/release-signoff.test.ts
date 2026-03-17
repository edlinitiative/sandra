/**
 * Sandra V2 release-signoff API contract tests.
 *
 * These tests exercise the current release surface as one coherent contract:
 * chat, streaming, repos, index, and health.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockRunSandraAgent,
  mockRunSandraAgentStream,
  mockGetActiveRepoSummaries,
  mockGetActiveRepos,
  mockGetRepoByRepoId,
  mockIndexAllRepositories,
  mockIndexRepositoriesByConfig,
  mockGetConfiguredRepos,
  mockQueryRaw,
  mockRepoRegistryCount,
  mockIndexedSourceCount,
  mockIndexedDocumentCount,
  mockVectorStoreCount,
  mockGetToolNames,
  mockRequireAdminAuth,
} = vi.hoisted(() => ({
  mockRunSandraAgent: vi.fn(),
  mockRunSandraAgentStream: vi.fn(),
  mockGetActiveRepoSummaries: vi.fn(),
  mockGetActiveRepos: vi.fn(),
  mockGetRepoByRepoId: vi.fn(),
  mockIndexAllRepositories: vi.fn(),
  mockIndexRepositoriesByConfig: vi.fn(),
  mockGetConfiguredRepos: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockRepoRegistryCount: vi.fn(),
  mockIndexedSourceCount: vi.fn(),
  mockIndexedDocumentCount: vi.fn(),
  mockVectorStoreCount: vi.fn(),
  mockGetToolNames: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
}));

const { mockGetSessionLanguage, mockEnsureSessionContinuity } = vi.hoisted(() => ({
  mockGetSessionLanguage: vi.fn(),
  mockEnsureSessionContinuity: vi.fn(),
}));

const { mockResolveCanonicalUser, mockGetCanonicalUserLanguage } = vi.hoisted(() => ({
  mockResolveCanonicalUser: vi.fn(),
  mockGetCanonicalUserLanguage: vi.fn(),
}));

vi.mock('@/lib/agents', () => ({
  runSandraAgent: mockRunSandraAgent,
  runSandraAgentStream: mockRunSandraAgentStream,
}));

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: mockQueryRaw,
    repoRegistry: { count: mockRepoRegistryCount },
    indexedSource: { count: mockIndexedSourceCount },
    indexedDocument: { count: mockIndexedDocumentCount },
  },
  getActiveRepoSummaries: mockGetActiveRepoSummaries,
  getActiveRepos: mockGetActiveRepos,
  getRepoByRepoId: mockGetRepoByRepoId,
}));

vi.mock('@/lib/github', () => ({
  indexAllRepositories: mockIndexAllRepositories,
  indexRepositoriesByConfig: mockIndexRepositoriesByConfig,
  getConfiguredRepos: mockGetConfiguredRepos,
}));

vi.mock('@/lib/knowledge', () => ({
  getVectorStore: () => ({
    count: mockVectorStoreCount,
  }),
}));

vi.mock('@/lib/tools', () => ({
  toolRegistry: {
    getToolNames: mockGetToolNames,
  },
}));

vi.mock('@/lib/utils/auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/lib/memory/session-continuity', () => ({
  getSessionLanguage: mockGetSessionLanguage,
  ensureSessionContinuity: mockEnsureSessionContinuity,
}));

vi.mock('@/lib/users/canonical-user', () => ({
  getCanonicalUserLanguage: mockGetCanonicalUserLanguage,
  resolveCanonicalUser: mockResolveCanonicalUser,
}));

vi.mock('@/lib/i18n', () => ({
  resolveLanguage: ({
    explicit,
    sessionLanguage,
  }: {
    explicit?: string;
    sessionLanguage?: string;
  }) => explicit ?? sessionLanguage ?? 'en',
}));

vi.mock('@/lib/config', () => ({
  env: {
    OPENAI_API_KEY: 'sk-test-validkeyfortesting',
    OPENAI_MODEL: 'gpt-4o',
    ADMIN_API_KEY: 'test-admin-key',
  },
  APP_NAME: 'Sandra',
  APP_VERSION: '1.0.0',
}));

function makeJsonRequest(url: string, body: unknown, extraHeaders?: Record<string, string>): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

async function readSseEvents(response: Response): Promise<Array<Record<string, unknown>>> {
  const reader = response.body?.getReader();
  if (!reader) return [];

  const decoder = new TextDecoder();
  let buffer = '';
  const events: Array<Record<string, unknown>> = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part
        .split('\n')
        .find((entry) => entry.startsWith('data: '));

      if (!line) continue;
      events.push(JSON.parse(line.slice(6)) as Record<string, unknown>);
    }
  }

  reader.releaseLock();
  return events;
}

describe('Sandra V2 release-signoff contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionLanguage.mockResolvedValue(undefined);
    mockEnsureSessionContinuity.mockResolvedValue(undefined);
    mockResolveCanonicalUser.mockResolvedValue({});
    mockGetCanonicalUserLanguage.mockResolvedValue(undefined);
    mockRequireAdminAuth.mockReturnValue(undefined);
    mockGetConfiguredRepos.mockReturnValue([
      {
        owner: 'edlinitiative',
        name: 'edlight-code',
        displayName: 'EdLight Code',
        description: 'Code platform',
        url: 'https://github.com/edlinitiative/edlight-code',
        branch: 'main',
        docsPath: 'docs',
        isActive: true,
      },
    ]);
    mockGetActiveRepoSummaries.mockResolvedValue([
      {
        id: 'repo-2',
        owner: 'edlinitiative',
        name: 'edlight-news',
        displayName: 'EdLight News',
        description: 'News platform',
        url: 'https://github.com/edlinitiative/edlight-news',
        branch: 'main',
        docsPath: 'docs',
        isActive: true,
        syncStatus: 'indexing',
        lastIndexedAt: null,
        indexedDocumentCount: 4,
      },
      {
        id: 'repo-1',
        owner: 'edlinitiative',
        name: 'edlight-code',
        displayName: 'EdLight Code',
        description: 'Code platform',
        url: 'https://github.com/edlinitiative/edlight-code',
        branch: 'main',
        docsPath: 'docs',
        isActive: true,
        syncStatus: 'indexed',
        lastIndexedAt: new Date('2026-03-17T00:00:00.000Z'),
        indexedDocumentCount: 12,
      },
    ]);
    mockGetActiveRepos.mockResolvedValue([
      {
        id: 'repo-1',
        owner: 'edlinitiative',
        name: 'edlight-code',
        displayName: 'EdLight Code',
      },
      {
        id: 'repo-2',
        owner: 'edlinitiative',
        name: 'edlight-news',
        displayName: 'EdLight News',
      },
    ]);
    mockGetRepoByRepoId.mockResolvedValue({
      id: 'repo-1',
      owner: 'edlinitiative',
      name: 'edlight-code',
      displayName: 'EdLight Code',
    });
    mockIndexAllRepositories.mockResolvedValue([
      {
        repoId: 'repo-1',
        repoFullName: 'edlinitiative/edlight-code',
        status: 'completed',
        documentsProcessed: 12,
        documentsSkipped: 0,
        documentsFailed: 0,
        filesIndexed: 12,
        chunksCreated: 48,
        startedAt: new Date('2026-03-17T10:00:00.000Z'),
        completedAt: new Date('2026-03-17T10:00:05.000Z'),
        duration: 5000,
        errors: [],
      },
      {
        repoId: 'repo-2',
        repoFullName: 'edlinitiative/edlight-news',
        status: 'failed',
        documentsProcessed: 0,
        documentsSkipped: 0,
        documentsFailed: 1,
        filesIndexed: 0,
        chunksCreated: 0,
        startedAt: new Date('2026-03-17T10:00:00.000Z'),
        completedAt: new Date('2026-03-17T10:00:04.000Z'),
        duration: 4000,
        error: 'GitHub unavailable',
        errors: ['GitHub unavailable'],
      },
    ]);
    mockIndexRepositoriesByConfig.mockResolvedValue([]);
    mockRunSandraAgent.mockResolvedValue({
      response: 'EdLight Code offers beginner-friendly coding paths.',
      language: 'en',
      toolsUsed: ['getCourseInventory', 'searchKnowledgeBase'],
      retrievalUsed: true,
      suggestedFollowUps: ['Do you want Academy courses too?'],
      tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    mockRunSandraAgentStream.mockImplementation(async function* () {
      yield { type: 'token', data: 'EdLight Code ' };
      yield { type: 'tool_call', data: 'getCourseInventory' };
      yield { type: 'token', data: 'has Python courses.' };
      yield {
        type: 'done',
        data: {
          sessionId: 'stream-session-1',
          response: 'EdLight Code has Python courses.',
          toolsUsed: ['getCourseInventory'],
          retrievalUsed: true,
          suggestedFollowUps: ['Want beginner picks?'],
        },
      };
    });
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRepoRegistryCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockIndexedSourceCount.mockResolvedValue(4);
    mockIndexedDocumentCount.mockResolvedValue(24);
    mockVectorStoreCount.mockResolvedValue(120);
    mockGetToolNames.mockReturnValue([
      'searchKnowledgeBase',
      'getEdLightInitiatives',
      'getCourseInventory',
      'getProgramsAndScholarships',
      'lookupRepoInfo',
    ]);
  });

  it('POST /api/chat returns the stable V2 response envelope', async () => {
    const { POST } = await import('../../app/api/chat/route');
    const response = await POST(
      makeJsonRequest('/api/chat', {
        message: 'What courses are on EdLight Code?',
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        language: 'en',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      response: 'EdLight Code offers beginner-friendly coding paths.',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      language: 'en',
      toolsUsed: ['getCourseInventory', 'searchKnowledgeBase'],
      retrievalUsed: true,
      suggestedFollowUps: ['Do you want Academy courses too?'],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    expect(body.meta.requestId).toBeDefined();
  });

  it('POST /api/chat/stream returns the stable SSE contract and terminal done payload', async () => {
    const { POST } = await import('../../app/api/chat/stream/route');
    const response = await POST(
      makeJsonRequest('/api/chat/stream', {
        message: 'What courses are on EdLight Code?',
        sessionId: 'stream-session-1',
        language: 'en',
      }),
    );

    expect(response.headers.get('Content-Type')).toContain('text/event-stream');

    const events = await readSseEvents(response);
    const types = events.map((event) => event.type);

    expect(types).toEqual(['start', 'token', 'tool_call', 'token', 'done']);
    expect(types.filter((type) => type === 'done')).toHaveLength(1);
    expect(types.filter((type) => type === 'error')).toHaveLength(0);

    const doneEvent = events.find((event) => event.type === 'done');
    expect(doneEvent).toMatchObject({
      type: 'done',
      sessionId: 'stream-session-1',
      response: 'EdLight Code has Python courses.',
      toolsUsed: ['getCourseInventory'],
      retrievalUsed: true,
      suggestedFollowUps: ['Want beginner picks?'],
    });
  });

  it('GET /api/repos returns the stable admin row contract', async () => {
    const { GET } = await import('../../app/api/repos/route');
    const response = await GET(
      new Request('http://localhost/api/repos', {
        headers: { 'x-api-key': 'test-admin-key' },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRequireAdminAuth).toHaveBeenCalledTimes(1);
    expect(body.data.repos).toHaveLength(2);
    expect(body.data.repos[0]).toMatchObject({
      owner: 'edlinitiative',
      name: 'edlight-code',
      displayName: 'EdLight Code',
      description: 'Code platform',
      branch: 'main',
      docsPath: 'docs',
      isActive: true,
      syncStatus: 'indexed',
      indexedDocumentCount: 12,
    });
  });

  it('POST /api/index preserves per-repo results and partial-success summary', async () => {
    const { POST } = await import('../../app/api/index/route');
    const response = await POST(
      makeJsonRequest('/api/index', {}, { 'x-api-key': 'test-admin-key' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRequireAdminAuth).toHaveBeenCalledTimes(1);
    expect(body.data.results).toHaveLength(2);
    expect(body.data.results[0]).toMatchObject({
      repoId: 'repo-1',
      status: 'completed',
      chunksCreated: 48,
    });
    expect(body.data.results[1]).toMatchObject({
      repoId: 'repo-2',
      status: 'failed',
      error: 'GitHub unavailable',
    });
    expect(body.data.summary).toMatchObject({
      total: 2,
      completed: 1,
      failed: 1,
      status: 'partial',
    });
  });

  it('GET /api/health returns the stable operator summary contract', async () => {
    const { GET } = await import('../../app/api/health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      name: 'Sandra',
      version: '1.0.0',
      status: 'ok',
      checks: {
        database: 'ok',
        vectorStore: 'ok',
      },
      summary: {
        repos: { total: 4, active: 4, indexed: 2, indexing: 1, error: 1 },
        tools: {
          count: 5,
          registered: [
            'searchKnowledgeBase',
            'getEdLightInitiatives',
            'getCourseInventory',
            'getProgramsAndScholarships',
            'lookupRepoInfo',
          ],
        },
        knowledge: { indexedSources: 4, indexedDocuments: 24, vectorStoreChunks: 120 },
      },
    });
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
