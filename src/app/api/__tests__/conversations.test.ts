import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockGetHistory } = vi.hoisted(() => ({
  mockGetHistory: vi.fn(),
}));

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@/lib/memory/session-store', () => ({
  getPrismaSessionStore: () => ({
    getMessages: mockGetHistory,
    getSession: mockGetSession,
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(sessionId: string) {
  return {
    params: Promise.resolve({ sessionId }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/conversations/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
  });

  it('returns 200 with message history for a valid session', async () => {
    const sessionId = crypto.randomUUID();
    mockGetHistory.mockResolvedValue([
      { role: 'user', content: 'Hello', createdAt: new Date('2024-01-01T00:00:00Z'), metadata: null },
      { role: 'assistant', content: 'Hi there!', createdAt: new Date('2024-01-01T00:00:01Z'), metadata: null },
    ]);

    const { GET } = await import('../conversations/[sessionId]/route');
    const request = new Request(`http://localhost/api/conversations/${sessionId}`);
    const response = await GET(request, makeContext(sessionId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBe(sessionId);
    expect(body.data.messages).toHaveLength(2);
    expect(body.data.messages[0]).toMatchObject({ role: 'user', content: 'Hello' });
    expect(body.data.messages[0].createdAt).toBeDefined();
    expect(body.meta.requestId).toBeDefined();
  });

  it('returns 404 when session has no history', async () => {
    const sessionId = crypto.randomUUID();
    mockGetHistory.mockResolvedValue([]);

    const { GET } = await import('../conversations/[sessionId]/route');
    const request = new Request(`http://localhost/api/conversations/${sessionId}`);
    const response = await GET(request, makeContext(sessionId));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for invalid (non-UUID) sessionId', async () => {
    const { GET } = await import('../conversations/[sessionId]/route');
    const request = new Request('http://localhost/api/conversations/not-a-uuid');
    const response = await GET(request, makeContext('not-a-uuid'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('messages do not include internal fields', async () => {
    const sessionId = crypto.randomUUID();
    mockGetHistory.mockResolvedValue([
      {
        role: 'user',
        content: 'Hello',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        metadata: { internal: 'data' },
        toolCallId: 'call_123',
      },
    ]);

    const { GET } = await import('../conversations/[sessionId]/route');
    const request = new Request(`http://localhost/api/conversations/${sessionId}`);
    const response = await GET(request, makeContext(sessionId));
    const body = await response.json();

    const msg = body.data.messages[0];
    expect(msg.metadata).toBeUndefined();
    expect(msg.toolCallId).toBeUndefined();
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
    expect(msg.createdAt).toBeDefined();
  });

  it('includes persisted session language when available', async () => {
    const sessionId = crypto.randomUUID();
    mockGetSession.mockResolvedValue({ id: sessionId, language: 'ht' });
    mockGetHistory.mockResolvedValue([
      { role: 'user', content: 'Bonjou', createdAt: new Date('2024-01-01T00:00:00Z'), metadata: null },
    ]);

    const { GET } = await import('../conversations/[sessionId]/route');
    const request = new Request(`http://localhost/api/conversations/${sessionId}`);
    const response = await GET(request, makeContext(sessionId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.language).toBe('ht');
  });
});
