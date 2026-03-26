import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRequest(
  path: string,
  options?: { method?: string; headers?: Record<string, string> },
): NextRequest {
  const url = `http://localhost:3000${path}`;
  return new NextRequest(url, {
    method: options?.method ?? 'GET',
    headers: options?.headers,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('passes through non-API requests', async () => {
    const { middleware } = await import('../middleware');
    const request = makeRequest('/chat');
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it('handles CORS preflight with 204', async () => {
    const { middleware } = await import('../middleware');
    const request = makeRequest('/api/chat', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    });
    const response = middleware(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('adds rate limit headers to API requests', async () => {
    const { middleware } = await import('../middleware');
    const request = makeRequest('/api/chat', {
      headers: { 'x-forwarded-for': '192.168.1.100' },
    });
    const response = middleware(request);

    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });

  it('exempts /api/health from rate limiting', async () => {
    const { middleware } = await import('../middleware');

    // Send many requests to health — should never be rate limited
    for (let i = 0; i < 100; i++) {
      const request = makeRequest('/api/health', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });
      const response = middleware(request);
      expect(response.status).toBe(200);
    }
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { middleware } = await import('../middleware');
    const ip = `rate-test-${Date.now()}`;

    // Exhaust the token bucket (60 tokens)
    for (let i = 0; i < 60; i++) {
      const request = makeRequest('/api/chat', {
        headers: { 'x-forwarded-for': ip },
      });
      const response = middleware(request);
      expect(response.status).toBe(200);
    }

    // 61st request should be rate limited
    const request = makeRequest('/api/chat', {
      headers: { 'x-forwarded-for': ip },
    });
    const response = middleware(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(response.headers.get('Retry-After')).toBeDefined();
  });

  it('skips static assets', async () => {
    const { middleware } = await import('../middleware');
    const request = makeRequest('/_next/static/chunk.js');
    const response = middleware(request);

    // Should pass through without modification
    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Limit')).toBeNull();
  });

  it('sets CORS headers for allowed origins', async () => {
    const { middleware } = await import('../middleware');
    const request = makeRequest('/api/chat', {
      headers: {
        origin: 'https://sandra.edlight.org',
        'x-forwarded-for': '172.16.0.1',
      },
    });
    const response = middleware(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://sandra.edlight.org');
  });

  it('sets CORS headers for *.edlight.org subdomains', async () => {
    const { middleware } = await import('../middleware');
    const request = makeRequest('/api/chat', {
      headers: {
        origin: 'https://academy.edlight.org',
        'x-forwarded-for': '172.16.0.2',
      },
    });
    const response = middleware(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://academy.edlight.org');
  });
});
