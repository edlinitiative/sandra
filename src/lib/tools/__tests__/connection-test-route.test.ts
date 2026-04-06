/**
 * Tests for the connection health-check endpoint
 * POST /api/tools/connections/[connectionId]/test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    externalApiConnection: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/auth/middleware', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({
    authenticated: true,
    user: { id: 'user-1', role: 'admin', scopes: ['*'], tenantId: 'tenant-1' },
  }),
}));

// ── Fetch mock ────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Import after mocks ────────────────────────────────────────────────────────
const { POST } = await import('../../../app/api/tools/connections/[connectionId]/test/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/tools/connections/conn-1/test', {
    method: 'POST',
  });
}

function makeContext(id = 'conn-1') {
  return { params: Promise.resolve({ connectionId: id }) };
}

const CONN = {
  id: 'conn-1',
  tenantId: 'tenant-1',
  name: 'Acme CRM',
  baseUrl: 'https://api.acme.com/v1',
  authType: 'api_key',
  credentials: { apiKey: 'sk-test' },
  authConfig: { headerName: 'X-API-Key' },
  defaultHeaders: null,
  lastHealthCheck: null,
  lastHealthStatus: null,
};

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdate.mockReset().mockResolvedValue({});
  mockFetch.mockReset();
});

describe('POST /api/tools/connections/[connectionId]/test', () => {
  it('returns 404 when connection does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json() as { error: string };

    expect(res.status).toBe(404);
    expect(body.error).toBe('Connection not found');
  });

  it('returns ok:true when the server responds with 200', async () => {
    mockFindUnique.mockResolvedValue(CONN);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json() as { ok: boolean; status: number; latencyMs: number; message: string };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe(200);
    expect(typeof body.latencyMs).toBe('number');
    expect(body.message).toContain('Reachable');
  });

  it('returns ok:true for 404 (server up, base URL has no root)', async () => {
    mockFindUnique.mockResolvedValue(CONN);
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json() as { ok: boolean; status: number };

    expect(body.ok).toBe(true);
    expect(body.status).toBe(404);
  });

  it('returns ok:false and error when server returns 401', async () => {
    mockFindUnique.mockResolvedValue(CONN);
    mockFetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json() as { ok: boolean; error?: string; message: string };

    expect(body.ok).toBe(false);
    expect(body.message).toContain('credentials');
  });

  it('returns ok:false on network error', async () => {
    mockFindUnique.mockResolvedValue(CONN);
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json() as { ok: boolean; message: string };

    expect(body.ok).toBe(false);
    expect(body.message).toContain('ECONNREFUSED');
  });

  it('returns ok:false on timeout', async () => {
    mockFindUnique.mockResolvedValue(CONN);
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    const res = await POST(makeRequest(), makeContext());
    const body = await res.json() as { ok: boolean; message: string };

    expect(body.ok).toBe(false);
    expect(body.message).toContain('Timed out');
  });

  it('persists health check result to the database', async () => {
    mockFindUnique.mockResolvedValue(CONN);
    mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

    await POST(makeRequest(), makeContext());

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-1' },
        data: expect.objectContaining({ lastHealthStatus: 'ok' }),
      }),
    );
  });

  it('sends auth header for api_key auth type', async () => {
    mockFindUnique.mockResolvedValue(CONN);
    mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

    await POST(makeRequest(), makeContext());

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(opts.headers['X-API-Key']).toBe('sk-test');
  });

  it('sends Bearer header for bearer auth type', async () => {
    mockFindUnique.mockResolvedValue({
      ...CONN,
      authType: 'bearer',
      credentials: { bearerToken: 'mytoken' },
      authConfig: {},
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

    await POST(makeRequest(), makeContext());

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(opts.headers['Authorization']).toBe('Bearer mytoken');
  });
});
