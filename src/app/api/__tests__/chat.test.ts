import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockRunSandraAgent } = vi.hoisted(() => ({
  mockRunSandraAgent: vi.fn(),
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
  runSandraAgentStream: vi.fn(),
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

vi.mock('@/lib/memory/session-continuity', () => ({
  getSessionLanguage: mockGetSessionLanguage,
  ensureSessionContinuity: mockEnsureSessionContinuity,
}));

vi.mock('@/lib/users/canonical-user', () => ({
  getCanonicalUserLanguage: mockGetCanonicalUserLanguage,
  resolveCanonicalUser: mockResolveCanonicalUser,
}));

vi.mock('@/lib/config', () => ({
  env: {
    OPENAI_API_KEY: 'sk-test-validkeyfortesting',
    OPENAI_MODEL: 'gpt-4o',
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionLanguage.mockResolvedValue(undefined);
    mockEnsureSessionContinuity.mockResolvedValue(undefined);
    mockResolveCanonicalUser.mockResolvedValue({});
    mockGetCanonicalUserLanguage.mockResolvedValue(undefined);
  });

  it('returns 200 with success envelope for valid message', async () => {
    mockRunSandraAgent.mockResolvedValue({
      response: 'Hello from Sandra!',
      language: 'en',
      toolsUsed: [],
      retrievalUsed: false,
      tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

    const { POST } = await import('../chat/route');
    const request = makeRequest({ message: 'Hello' });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.response).toBe('Hello from Sandra!');
    expect(body.data.sessionId).toBeDefined();
    expect(body.meta.requestId).toBeDefined();
  });

  it('returns 400 for empty message', async () => {
    const { POST } = await import('../chat/route');
    const request = makeRequest({ message: '' });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.meta.requestId).toBeDefined();
  });

  it('returns 400 for missing message', async () => {
    const { POST } = await import('../chat/route');
    const request = makeRequest({});
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../chat/route');
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('passes sessionId through when provided', async () => {
    const sessionId = crypto.randomUUID();
    mockRunSandraAgent.mockResolvedValue({
      response: 'Reply',
      language: 'en',
      toolsUsed: [],
      retrievalUsed: false,
      tokenUsage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    });

    const { POST } = await import('../chat/route');
    const request = makeRequest({ message: 'Hello', sessionId });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.sessionId).toBe(sessionId);
  });

  it('falls back to persisted session language when no explicit language is provided', async () => {
    const sessionId = crypto.randomUUID();
    mockGetSessionLanguage.mockResolvedValue('fr');
    mockRunSandraAgent.mockResolvedValue({
      response: 'Bonjour!',
      language: 'fr',
      toolsUsed: [],
      retrievalUsed: false,
      tokenUsage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    });

    const { POST } = await import('../chat/route');
    const request = makeRequest({ message: 'Hello', sessionId });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockRunSandraAgent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId, language: 'fr' }),
    );
    expect(mockEnsureSessionContinuity).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId, language: 'fr', channel: 'web' }),
    );
  });

  it('passes the canonical userId through continuity and agent execution', async () => {
    const sessionId = crypto.randomUUID();
    mockResolveCanonicalUser.mockResolvedValue({ userId: 'user_123' });
    mockRunSandraAgent.mockResolvedValue({
      response: 'Reply',
      language: 'en',
      toolsUsed: [],
      retrievalUsed: false,
      tokenUsage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    });

    const { POST } = await import('../chat/route');
    const response = await POST(makeRequest({ message: 'Hello', sessionId, userId: 'web:anon-123' }));

    expect(response.status).toBe(200);
    expect(mockResolveCanonicalUser).toHaveBeenCalledWith({
      sessionId,
      externalUserId: 'web:anon-123',
      language: 'en',
      channel: 'web',
    });
    expect(mockEnsureSessionContinuity).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId, userId: 'user_123' }),
    );
    expect(mockRunSandraAgent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId, userId: 'user_123' }),
    );
  });

  it('uses the stored canonical user language for a brand-new session', async () => {
    mockGetCanonicalUserLanguage.mockResolvedValue('ht');
    mockRunSandraAgent.mockResolvedValue({
      response: 'Bonjou!',
      language: 'ht',
      toolsUsed: [],
      retrievalUsed: false,
      tokenUsage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    });

    const { POST } = await import('../chat/route');
    const response = await POST(makeRequest({ message: 'Hello', userId: 'web:anon-123' }));

    expect(response.status).toBe(200);
    expect(mockGetCanonicalUserLanguage).toHaveBeenCalledWith('web:anon-123');
    expect(mockRunSandraAgent).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'ht' }),
    );
  });

  it('returns 500 when agent throws an unexpected error', async () => {
    mockRunSandraAgent.mockRejectedValue(new Error('Unexpected failure'));

    const { POST } = await import('../chat/route');
    const request = makeRequest({ message: 'Hello' });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
