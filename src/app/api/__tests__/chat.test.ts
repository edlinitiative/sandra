import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockRunSandraAgent } = vi.hoisted(() => ({
  mockRunSandraAgent: vi.fn(),
}));

vi.mock('@/lib/agents', () => ({
  runSandraAgent: mockRunSandraAgent,
  runSandraAgentStream: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  resolveLanguage: ({ explicit }: { explicit?: string }) => explicit ?? 'en',
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
