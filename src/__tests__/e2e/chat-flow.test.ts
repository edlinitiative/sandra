/**
 * T120: End-to-End Chat Flow Verification
 *
 * Tests the full chat flow:
 *   1. POST /api/chat → response + sessionId
 *   2. Follow-up POST with same sessionId → contextual response
 *   3. SSE streaming endpoint → token events + 'done'
 *   4. GET /api/conversations/[sessionId] → full message history
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRunSandraAgent, mockRunSandraAgentStream } = vi.hoisted(() => ({
  mockRunSandraAgent: vi.fn(),
  mockRunSandraAgentStream: vi.fn(),
}));

const { mockGetHistory, mockAddEntry, mockGetContextMessages, mockGetSession } = vi.hoisted(() => ({
  mockGetHistory: vi.fn(),
  mockAddEntry: vi.fn(),
  mockGetContextMessages: vi.fn(),
  mockGetSession: vi.fn(),
}));

const { mockGetSessionLanguage, mockEnsureSessionContinuity } = vi.hoisted(() => ({
  mockGetSessionLanguage: vi.fn(),
  mockEnsureSessionContinuity: vi.fn(),
}));

const { mockResolveCanonicalUser, mockGetCanonicalUserLanguage } = vi.hoisted(() => ({
  mockResolveCanonicalUser: vi.fn(),
  mockGetCanonicalUserLanguage: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/agents', () => ({
  runSandraAgent: mockRunSandraAgent,
  runSandraAgentStream: mockRunSandraAgentStream,
}));

vi.mock('@/lib/memory/session-store', () => ({
  getSessionStore: () => ({
    getHistory: mockGetHistory,
    addEntry: mockAddEntry,
    getContextMessages: mockGetContextMessages,
  }),
  getPrismaSessionStore: () => ({
    getMessages: mockGetHistory,
    getSession: mockGetSession,
  }),
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
  env: { OPENAI_API_KEY: 'sk-test-validkeyfortesting' },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChatRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeStreamRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const baseAgentResult = {
  response: 'Sandra here! How can I help?',
  language: 'en' as const,
  toolsUsed: [],
  retrievalUsed: false,
  tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('T120: End-to-End Chat Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHistory.mockResolvedValue([]);
    mockGetContextMessages.mockResolvedValue([]);
    mockAddEntry.mockResolvedValue(undefined);
    mockGetSession.mockResolvedValue(null);
    mockGetSessionLanguage.mockResolvedValue(undefined);
    mockEnsureSessionContinuity.mockResolvedValue(undefined);
    mockResolveCanonicalUser.mockResolvedValue({});
    mockGetCanonicalUserLanguage.mockResolvedValue(undefined);
  });

  it('POST /api/chat returns a valid sessionId and assistant response', async () => {
    mockRunSandraAgent.mockResolvedValue(baseAgentResult);

    const { POST } = await import('../../app/api/chat/route');
    const response = await POST(makeChatRequest({ message: 'Tell me about EdLight' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBeDefined();
    expect(typeof body.data.sessionId).toBe('string');
    expect(body.data.response).toBe('Sandra here! How can I help?');
    expect(body.meta.requestId).toBeDefined();
  });

  it('follow-up message with the same sessionId returns a response', async () => {
    const sessionId = crypto.randomUUID();
    mockRunSandraAgent
      .mockResolvedValueOnce({ ...baseAgentResult, response: 'First response' })
      .mockResolvedValueOnce({ ...baseAgentResult, response: 'Follow-up response' });

    const { POST } = await import('../../app/api/chat/route');

    // First message
    const first = await POST(makeChatRequest({ message: 'Hello', sessionId }));
    const firstBody = await first.json();
    expect(firstBody.data.sessionId).toBe(sessionId);

    // Follow-up
    const second = await POST(makeChatRequest({ message: 'Tell me more', sessionId }));
    const secondBody = await second.json();

    expect(second.status).toBe(200);
    expect(secondBody.data.sessionId).toBe(sessionId);
    expect(secondBody.data.response).toBe('Follow-up response');

    // Agent was called twice with same sessionId
    expect(mockRunSandraAgent).toHaveBeenCalledTimes(2);
    expect(mockRunSandraAgent.mock.calls[0]![0]).toMatchObject({ sessionId });
    expect(mockRunSandraAgent.mock.calls[1]![0]).toMatchObject({ sessionId });
  });

  it('streaming endpoint delivers token events and completes with done', async () => {
    // eslint-disable-next-line require-yield
    mockRunSandraAgentStream.mockImplementation(async function* () {
      yield { type: 'token', data: 'Hello ' };
      yield { type: 'token', data: 'from Sandra!' };
      yield {
        type: 'done',
        data: {
          sessionId: 'test-session',
          response: 'Hello from Sandra!',
          toolsUsed: [],
          retrievalUsed: false,
          suggestedFollowUps: ['What can you help with next?'],
        },
      };
    });

    const { POST } = await import('../../app/api/chat/stream/route');
    const response = await POST(makeStreamRequest({ message: 'Hello' }));

    expect(response.headers.get('Content-Type')).toContain('text/event-stream');

    // Read SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: unknown[] = [];
    let done = false;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) {
        const text = decoder.decode(value);
        const lines = text.split('\n\n').filter((l) => l.startsWith('data: '));
        for (const line of lines) {
          events.push(JSON.parse(line.slice(6)));
        }
      }
    }

    // Should have: start, token, token, done
    const types = (events as Array<{ type: string }>).map((e) => e.type);
    expect(types).toContain('start');
    expect(types).toContain('token');
    expect(types).toContain('done');
    expect(types.filter((t) => t === 'token')).toHaveLength(2);

    const doneEvent = (events as Array<Record<string, unknown>>).find((event) => event.type === 'done');
    expect(doneEvent).toMatchObject({
      sessionId: 'test-session',
      response: 'Hello from Sandra!',
      toolsUsed: [],
      retrievalUsed: false,
      suggestedFollowUps: ['What can you help with next?'],
    });
  });

  it('GET /api/conversations/[sessionId] returns messages in order', async () => {
    const sessionId = crypto.randomUUID();
    mockGetHistory.mockResolvedValue([
      { role: 'user', content: 'Hello Sandra', createdAt: new Date('2024-01-01T00:00:00Z'), metadata: null },
      { role: 'assistant', content: 'Hi there!', createdAt: new Date('2024-01-01T00:00:01Z'), metadata: null },
    ]);

    const { GET } = await import('../../app/api/conversations/[sessionId]/route');
    const request = new Request(`http://localhost/api/conversations/${sessionId}`);
    const response = await GET(request, { params: Promise.resolve({ sessionId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBe(sessionId);
    expect(body.data.messages).toHaveLength(2);
    expect(body.data.messages[0]).toMatchObject({ role: 'user', content: 'Hello Sandra' });
    expect(body.data.messages[1]).toMatchObject({ role: 'assistant', content: 'Hi there!' });
  });

  it('sessionId is consistent across the conversation', async () => {
    const sessionId = crypto.randomUUID();
    mockRunSandraAgent.mockResolvedValue({ ...baseAgentResult });

    const { POST } = await import('../../app/api/chat/route');
    const response = await POST(makeChatRequest({ message: 'Keep this id', sessionId }));
    const body = await response.json();

    expect(body.data.sessionId).toBe(sessionId);
  });
});
