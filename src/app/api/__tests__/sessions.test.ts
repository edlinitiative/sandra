import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockFindMany, mockSessionCount } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockSessionCount: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    session: {
      findMany: mockFindMany,
      count: mockSessionCount,
    },
  },
}));

vi.mock('@/lib/utils/auth', () => ({
  requireAdminAuth: vi.fn(),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated session list', async () => {
    const sessions = [
      {
        id: 's1',
        channel: 'web',
        language: 'en',
        title: null,
        isActive: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        _count: { messages: 5 },
      },
      {
        id: 's2',
        channel: 'web',
        language: 'fr',
        title: 'French session',
        isActive: true,
        createdAt: new Date('2026-01-03'),
        updatedAt: new Date('2026-01-04'),
        _count: { messages: 10 },
      },
    ];
    mockFindMany.mockResolvedValue(sessions);
    mockSessionCount.mockResolvedValue(2);

    const { GET } = await import('../sessions/route');
    const request = new Request('http://localhost/api/sessions', {
      headers: { 'x-api-key': 'test-key' },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sessions).toHaveLength(2);
    expect(body.data.sessions[0]).toMatchObject({
      id: 's1',
      messageCount: 5,
      language: 'en',
    });
    expect(body.data.sessions[1]).toMatchObject({
      id: 's2',
      messageCount: 10,
      title: 'French session',
    });
    expect(body.data.pagination).toMatchObject({
      total: 2,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
  });

  it('respects limit and offset query params', async () => {
    mockFindMany.mockResolvedValue([]);
    mockSessionCount.mockResolvedValue(100);

    const { GET } = await import('../sessions/route');
    const request = new Request('http://localhost/api/sessions?limit=10&offset=20', {
      headers: { 'x-api-key': 'test-key' },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.pagination).toMatchObject({
      total: 100,
      limit: 10,
      offset: 20,
      hasMore: true,
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 }),
    );
  });

  it('clamps limit to max 200', async () => {
    mockFindMany.mockResolvedValue([]);
    mockSessionCount.mockResolvedValue(0);

    const { GET } = await import('../sessions/route');
    const request = new Request('http://localhost/api/sessions?limit=999', {
      headers: { 'x-api-key': 'test-key' },
    });
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });

  it('requires admin authentication', async () => {
    const { requireAdminAuth } = await import('@/lib/utils/auth');
    const { AuthError } = await import('@/lib/utils/errors');
    vi.mocked(requireAdminAuth).mockImplementation(() => {
      throw new AuthError('Invalid or missing API key');
    });

    const { GET } = await import('../sessions/route');
    const request = new Request('http://localhost/api/sessions');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });
});
