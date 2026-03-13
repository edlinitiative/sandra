import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthError, ConfigurationError } from '../errors';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { ADMIN_API_KEY: 'test-api-key-12345' as string | undefined },
}));

vi.mock('@/lib/config', () => ({
  env: mockEnv,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(apiKey?: string): Request {
  const headers: Record<string, string> = {};
  if (apiKey !== undefined) {
    headers['x-api-key'] = apiKey;
  }
  return new Request('http://localhost/api/repos', { headers });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('requireAdminAuth', () => {
  beforeEach(() => {
    mockEnv.ADMIN_API_KEY = 'test-api-key-12345';
  });

  it('passes for valid API key', async () => {
    const { requireAdminAuth } = await import('../auth');
    const request = makeRequest('test-api-key-12345');
    expect(() => requireAdminAuth(request)).not.toThrow();
  });

  it('throws AuthError for invalid API key', async () => {
    const { requireAdminAuth } = await import('../auth');
    const request = makeRequest('wrong-key');
    expect(() => requireAdminAuth(request)).toThrow(AuthError);
  });

  it('throws AuthError when x-api-key header is missing', async () => {
    const { requireAdminAuth } = await import('../auth');
    const request = makeRequest();
    expect(() => requireAdminAuth(request)).toThrow(AuthError);
  });

  it('AuthError has code AUTH_ERROR and status 401', async () => {
    const { requireAdminAuth } = await import('../auth');
    const request = makeRequest('bad-key');
    try {
      requireAdminAuth(request);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe('AUTH_ERROR');
      expect((err as AuthError).statusCode).toBe(401);
    }
  });

  it('throws ConfigurationError when ADMIN_API_KEY is not set', async () => {
    mockEnv.ADMIN_API_KEY = undefined;
    const { requireAdminAuth } = await import('../auth');
    const request = makeRequest('any-key');
    expect(() => requireAdminAuth(request)).toThrow(ConfigurationError);
  });
});
