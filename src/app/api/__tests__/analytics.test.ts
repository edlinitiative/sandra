import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnalyticsSummary } from '@/lib/analytics/types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const { mockGetAnalyticsSummary, mockEnv } = vi.hoisted(() => ({
  mockGetAnalyticsSummary: vi.fn(),
  mockEnv: { ADMIN_API_KEY: 'test-admin-key' as string | undefined },
}));

vi.mock('@/lib/analytics', () => ({
  getAnalyticsSummary: mockGetAnalyticsSummary,
}));

vi.mock('@/lib/config', () => ({ env: mockEnv }));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FROM = new Date('2026-01-01T00:00:00Z');
const TO   = new Date('2026-01-07T23:59:59Z');

const mockSummary: AnalyticsSummary = {
  totalEvents: 500,
  byEventType: { message_sent: 200, tool_executed: 150, response_generated: 150 },
  byChannel: { web: 300, whatsapp: 200 },
  byLanguage: { en: 400, fr: 100 },
  topTools: [{ tool: 'searchKnowledge', count: 100 }],
  averageResponseMs: 1200,
  cacheHitRate: 0.35,
  period: { from: FROM, to: TO },
};

function makeRequest(
  url: string,
  options: { apiKey?: string } = {},
): Request {
  const headers: Record<string, string> = {};
  if (options.apiKey) headers['x-api-key'] = options.apiKey;
  return new Request(url, { method: 'GET', headers });
}

// ─── GET /api/analytics ───────────────────────────────────────────────────────

describe('GET /api/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.ADMIN_API_KEY = 'test-admin-key';
    mockGetAnalyticsSummary.mockResolvedValue(mockSummary);
  });

  it('returns 200 with analytics summary for valid admin key', async () => {
    const { GET } = await import('../analytics/route');
    const req = makeRequest('http://localhost/api/analytics', { apiKey: 'test-admin-key' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totalEvents).toBe(500);
    expect(body.data.cacheHitRate).toBe(0.35);
  });

  it('returns 401 when no API key is provided', async () => {
    const { GET } = await import('../analytics/route');
    const req = makeRequest('http://localhost/api/analytics');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong API key is provided', async () => {
    const { GET } = await import('../analytics/route');
    const req = makeRequest('http://localhost/api/analytics', { apiKey: 'wrong-key' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('passes from/to query params to getAnalyticsSummary', async () => {
    const { GET } = await import('../analytics/route');
    const req = makeRequest(
      'http://localhost/api/analytics?from=2026-01-01T00:00:00Z&to=2026-01-07T23:59:59Z',
      { apiKey: 'test-admin-key' },
    );
    await GET(req);
    expect(mockGetAnalyticsSummary).toHaveBeenCalledOnce();
    const [from, to] = mockGetAnalyticsSummary.mock.calls[0] as [Date, Date];
    expect(from).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(to).toEqual(new Date('2026-01-07T23:59:59Z'));
  });

  it('defaults to last 7 days when no date params provided', async () => {
    const { GET } = await import('../analytics/route');
    const req = makeRequest('http://localhost/api/analytics', { apiKey: 'test-admin-key' });
    await GET(req);
    expect(mockGetAnalyticsSummary).toHaveBeenCalledOnce();
    const [from, to] = mockGetAnalyticsSummary.mock.calls[0] as [Date, Date];
    // From should be approximately 7 days ago
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(to.getTime() - from.getTime()).toBeCloseTo(sevenDaysMs, -3); // within 1 second
  });

  it('returns 4xx for invalid from date', async () => {
    const { GET } = await import('../analytics/route');
    const req = makeRequest(
      'http://localhost/api/analytics?from=not-a-date',
      { apiKey: 'test-admin-key' },
    );
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('returns 4xx when from is after to', async () => {
    const { GET } = await import('../analytics/route');
    const req = makeRequest(
      'http://localhost/api/analytics?from=2026-01-07&to=2026-01-01',
      { apiKey: 'test-admin-key' },
    );
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('returns 500 when getAnalyticsSummary throws', async () => {
    mockGetAnalyticsSummary.mockRejectedValue(new Error('DB failure'));
    const { GET } = await import('../analytics/route');
    const req = makeRequest('http://localhost/api/analytics', { apiKey: 'test-admin-key' });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('response envelope includes requestId in meta', async () => {
    const { GET } = await import('../analytics/route');
    const req = makeRequest('http://localhost/api/analytics', { apiKey: 'test-admin-key' });
    const res = await GET(req);
    const body = await res.json();
    expect(body).toHaveProperty('meta.requestId');
  });

  it('includes byChannel and byLanguage in summary', async () => {
    const { GET } = await import('../analytics/route');
    const req = makeRequest('http://localhost/api/analytics', { apiKey: 'test-admin-key' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.byChannel.web).toBe(300);
    expect(body.data.byLanguage.en).toBe(400);
  });
});
