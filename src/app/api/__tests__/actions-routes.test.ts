import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const {
  mockListActions,
  mockGetActionById,
  mockApproveAction,
  mockRejectAction,
  mockEnv,
} = vi.hoisted(() => ({
  mockListActions:    vi.fn(),
  mockGetActionById:  vi.fn(),
  mockApproveAction:  vi.fn(),
  mockRejectAction:   vi.fn(),
  mockEnv:            { ADMIN_API_KEY: 'test-admin-key' as string | undefined },
}));

vi.mock('@/lib/actions/queue', () => ({
  listActions:   mockListActions,
  getActionById: mockGetActionById,
  approveAction: mockApproveAction,
  rejectAction:  mockRejectAction,
}));

vi.mock('@/lib/config', () => ({
  env: mockEnv,
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date('2026-03-27T12:00:00Z');

function makeEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:               'action-1',
    userId:           'user-1',
    sessionId:        'sess-1',
    channel:          'web',
    tool:             'createLead',
    input:            { interest: 'EdLight Code' },
    status:           'pending',
    requiresApproval: true,
    requestedAt:      now,
    reviewedAt:       null,
    reviewedBy:       null,
    reviewNote:       null,
    result:           null,
    metadata:         null,
    createdAt:        now,
    updatedAt:        now,
    ...overrides,
  };
}

function makeRequest(
  url: string,
  options: { method?: string; apiKey?: string; body?: unknown } = {},
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.apiKey) headers['x-api-key'] = options.apiKey;
  return new Request(url, {
    method:  options.method ?? 'GET',
    headers,
    body:    options.body ? JSON.stringify(options.body) : undefined,
  });
}

// ─── GET /api/actions ─────────────────────────────────────────────────────────

describe('GET /api/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.ADMIN_API_KEY = 'test-admin-key';
    mockListActions.mockResolvedValue({ actions: [makeEntry()], total: 1 });
  });

  it('returns 200 with action list for valid admin key', async () => {
    const { GET } = await import('../actions/route');
    const req = makeRequest('http://localhost/api/actions', { apiKey: 'test-admin-key' });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.actions).toHaveLength(1);
    expect(body.data.total).toBe(1);
    expect(body.meta.requestId).toBeDefined();
  });

  it('returns 401 without API key', async () => {
    const { GET } = await import('../actions/route');
    const res = await GET(makeRequest('http://localhost/api/actions'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 401 with wrong API key', async () => {
    const { GET } = await import('../actions/route');
    const res = await GET(makeRequest('http://localhost/api/actions', { apiKey: 'bad-key' }));
    expect(res.status).toBe(401);
  });

  it('passes status filter from query params', async () => {
    const { GET } = await import('../actions/route');
    const req = makeRequest(
      'http://localhost/api/actions?status=pending',
      { apiKey: 'test-admin-key' },
    );
    await GET(req);

    const opts = mockListActions.mock.calls[0]![0];
    expect(opts.status).toBe('pending');
  });

  it('ignores invalid status values', async () => {
    const { GET } = await import('../actions/route');
    const req = makeRequest(
      'http://localhost/api/actions?status=badstatus',
      { apiKey: 'test-admin-key' },
    );
    await GET(req);

    const opts = mockListActions.mock.calls[0]![0];
    expect(opts.status).toBeUndefined();
  });

  it('passes tool filter from query params', async () => {
    const { GET } = await import('../actions/route');
    const req = makeRequest(
      'http://localhost/api/actions?tool=draftEmail',
      { apiKey: 'test-admin-key' },
    );
    await GET(req);

    const opts = mockListActions.mock.calls[0]![0];
    expect(opts.tool).toBe('draftEmail');
  });

  it('respects limit and offset params', async () => {
    const { GET } = await import('../actions/route');
    const req = makeRequest(
      'http://localhost/api/actions?limit=10&offset=20',
      { apiKey: 'test-admin-key' },
    );
    await GET(req);

    const opts = mockListActions.mock.calls[0]![0];
    expect(opts.limit).toBe(10);
    expect(opts.offset).toBe(20);
  });

  it('caps limit at 200', async () => {
    const { GET } = await import('../actions/route');
    const req = makeRequest(
      'http://localhost/api/actions?limit=9999',
      { apiKey: 'test-admin-key' },
    );
    await GET(req);

    const opts = mockListActions.mock.calls[0]![0];
    expect(opts.limit).toBe(200);
  });
});

// ─── GET /api/actions/[id] ────────────────────────────────────────────────────

describe('GET /api/actions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.ADMIN_API_KEY = 'test-admin-key';
    mockGetActionById.mockResolvedValue(makeEntry());
  });

  it('returns 200 with action for valid ID', async () => {
    const { GET } = await import('../actions/[id]/route');
    const req = makeRequest('http://localhost/api/actions/action-1', { apiKey: 'test-admin-key' });
    const res = await GET(req, { params: Promise.resolve({ id: 'action-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.action.id).toBe('action-1');
  });

  it('returns 404 when action not found', async () => {
    mockGetActionById.mockResolvedValueOnce(null);
    const { GET } = await import('../actions/[id]/route');
    const req = makeRequest('http://localhost/api/actions/no-such', { apiKey: 'test-admin-key' });
    const res = await GET(req, { params: Promise.resolve({ id: 'no-such' }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 without API key', async () => {
    const { GET } = await import('../actions/[id]/route');
    const req = makeRequest('http://localhost/api/actions/action-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'action-1' }) });
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/actions/[id]/approve ──────────────────────────────────────────

describe('POST /api/actions/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.ADMIN_API_KEY = 'test-admin-key';
    mockApproveAction.mockResolvedValue(makeEntry({ status: 'approved', reviewedBy: 'admin@edlight.org' }));
  });

  it('returns 200 with approved action', async () => {
    const { POST } = await import('../actions/[id]/approve/route');
    const req = makeRequest(
      'http://localhost/api/actions/action-1/approve',
      { method: 'POST', apiKey: 'test-admin-key', body: { reviewedBy: 'admin@edlight.org', note: 'Looks good' } },
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'action-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.action.status).toBe('approved');
  });

  it('uses default reviewedBy="admin" when not provided in body', async () => {
    const { POST } = await import('../actions/[id]/approve/route');
    const req = makeRequest(
      'http://localhost/api/actions/action-1/approve',
      { method: 'POST', apiKey: 'test-admin-key', body: {} },
    );
    await POST(req, { params: Promise.resolve({ id: 'action-1' }) });

    const reviewedBy = mockApproveAction.mock.calls[0]?.[1];
    expect(reviewedBy).toBe('admin');
  });

  it('returns 401 without API key', async () => {
    const { POST } = await import('../actions/[id]/approve/route');
    const req = makeRequest(
      'http://localhost/api/actions/action-1/approve',
      { method: 'POST', body: { reviewedBy: 'admin' } },
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'action-1' }) });
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/actions/[id]/reject ───────────────────────────────────────────

describe('POST /api/actions/[id]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.ADMIN_API_KEY = 'test-admin-key';
    mockRejectAction.mockResolvedValue(makeEntry({ status: 'rejected', reviewedBy: 'admin', reviewNote: 'Policy violation' }));
  });

  it('returns 200 with rejected action', async () => {
    const { POST } = await import('../actions/[id]/reject/route');
    const req = makeRequest(
      'http://localhost/api/actions/action-1/reject',
      { method: 'POST', apiKey: 'test-admin-key', body: { reviewedBy: 'admin', reason: 'Policy violation' } },
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'action-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.action.status).toBe('rejected');
  });

  it('passes reason as the third argument', async () => {
    const { POST } = await import('../actions/[id]/reject/route');
    const req = makeRequest(
      'http://localhost/api/actions/action-1/reject',
      { method: 'POST', apiKey: 'test-admin-key', body: { reviewedBy: 'admin', reason: 'Not allowed' } },
    );
    await POST(req, { params: Promise.resolve({ id: 'action-1' }) });

    const reason = mockRejectAction.mock.calls[0]?.[2];
    expect(reason).toBe('Not allowed');
  });

  it('returns 401 without API key', async () => {
    const { POST } = await import('../actions/[id]/reject/route');
    const req = makeRequest(
      'http://localhost/api/actions/action-1/reject',
      { method: 'POST', body: { reviewedBy: 'admin' } },
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'action-1' }) });
    expect(res.status).toBe(401);
  });
});
