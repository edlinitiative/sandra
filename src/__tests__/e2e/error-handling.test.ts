/**
 * T123: Error Handling Verification
 *
 * Verifies that all API endpoints handle errors consistently:
 *   - Invalid JSON body → 400 with error envelope
 *   - Missing required fields → 400 with specific field errors
 *   - Provider error (LLM down) → 502 with user-friendly message
 *   - Not found → 404 with error envelope
 *   - Internal error → 500 with generic message (no stack traces)
 *   - All error responses include meta.requestId
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderError } from '@/lib/utils/errors';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRunSandraAgent } = vi.hoisted(() => ({
  mockRunSandraAgent: vi.fn(),
}));

const { mockGetHistory, mockGetSession } = vi.hoisted(() => ({
  mockGetHistory: vi.fn(),
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
  runSandraAgentStream: vi.fn(),
}));

vi.mock('@/lib/memory/session-store', () => ({
  getSessionStore: () => ({
    getHistory: mockGetHistory,
    addEntry: vi.fn(),
    getContextMessages: vi.fn().mockResolvedValue([]),
  }),
  getPrismaSessionStore: () => ({
    getMessages: mockGetHistory,
    getSession: mockGetSession,
  }),
}));

vi.mock('@/lib/config', () => ({
  env: { OPENAI_API_KEY: 'sk-test-validkeyfortesting' },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChatRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('T123: Error Handling Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHistory.mockResolvedValue([]);
    mockGetSession.mockResolvedValue(null);
    mockGetSessionLanguage.mockResolvedValue(undefined);
    mockEnsureSessionContinuity.mockResolvedValue(undefined);
    mockResolveCanonicalUser.mockResolvedValue({});
    mockGetCanonicalUserLanguage.mockResolvedValue(undefined);
  });

  describe('POST /api/chat error cases', () => {
    it('returns 400 with error envelope for invalid JSON body', async () => {
      const { POST } = await import('../../app/api/chat/route');
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }',
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.meta?.requestId).toBeDefined();
    });

    it('returns 400 with field errors for missing required fields', async () => {
      const { POST } = await import('../../app/api/chat/route');
      const response = await POST(makeChatRequest({}));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.meta?.requestId).toBeDefined();
    });

    it('returns 400 for empty message string', async () => {
      const { POST } = await import('../../app/api/chat/route');
      const response = await POST(makeChatRequest({ message: '' }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 502 when provider throws a ProviderError', async () => {
      mockRunSandraAgent.mockRejectedValue(
        new ProviderError('openai', 'Service unavailable'),
      );

      const { POST } = await import('../../app/api/chat/route');
      const response = await POST(makeChatRequest({ message: 'Hello' }));
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('PROVIDER_ERROR');
      expect(body.meta?.requestId).toBeDefined();
    });

    it('returns 500 with generic message for unexpected errors (no stack trace)', async () => {
      mockRunSandraAgent.mockRejectedValue(new Error('Something broke internally'));

      const { POST } = await import('../../app/api/chat/route');
      const response = await POST(makeChatRequest({ message: 'Hello' }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
      // No stack trace should appear in the response
      expect(JSON.stringify(body)).not.toContain('at Object.');
      expect(JSON.stringify(body)).not.toContain('node_modules');
      expect(body.meta?.requestId).toBeDefined();
    });

    it('all error responses include meta.requestId', async () => {
      const { POST } = await import('../../app/api/chat/route');

      const responses = await Promise.all([
        POST(makeChatRequest({})),
        POST(makeChatRequest({ message: '' })),
        POST(
          new Request('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'bad json',
          }),
        ),
      ]);

      for (const response of responses) {
        const body = await response.json();
        expect(body.meta?.requestId).toBeDefined();
        expect(typeof body.meta.requestId).toBe('string');
        expect(body.meta.requestId.length).toBeGreaterThan(0);
      }
    });
  });

  describe('GET /api/conversations/[sessionId] error cases', () => {
    it('returns 404 when session has no history', async () => {
      const sessionId = crypto.randomUUID();
      mockGetHistory.mockResolvedValue([]);

      const { GET } = await import('../../app/api/conversations/[sessionId]/route');
      const request = new Request(`http://localhost/api/conversations/${sessionId}`);
      const response = await GET(request, { params: Promise.resolve({ sessionId }) });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.meta?.requestId).toBeDefined();
    });

    it('returns 400 for invalid (non-UUID) sessionId', async () => {
      const { GET } = await import('../../app/api/conversations/[sessionId]/route');
      const request = new Request('http://localhost/api/conversations/not-a-uuid');
      const response = await GET(request, { params: Promise.resolve({ sessionId: 'not-a-uuid' }) });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error response format', () => {
    it('error envelope matches { success: false, error: { code, message }, meta: { requestId } }', async () => {
      const { POST } = await import('../../app/api/chat/route');
      const response = await POST(makeChatRequest({}));
      const body = await response.json();

      expect(body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
        meta: {
          requestId: expect.any(String),
        },
      });
    });
  });
});
