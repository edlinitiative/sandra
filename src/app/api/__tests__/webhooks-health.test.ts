import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnv, mockDb } = vi.hoisted(() => ({
  mockEnv: {
    ADMIN_API_KEY: 'test-admin-key' as string | undefined,
    WHATSAPP_WEBHOOK_SECRET: 'wa-secret' as string | undefined,
    WHATSAPP_ACCESS_TOKEN: 'wa-token' as string | undefined,
    BUSINESS_META_TOKEN: undefined as string | undefined,
    INSTAGRAM_PAGE_ACCESS_TOKEN: 'ig-token' as string | undefined,
    INSTAGRAM_APP_SECRET: 'ig-secret' as string | undefined,
    WHATSAPP_APP_SECRET: undefined as string | undefined,
    SANDRA_EMAIL_ADDRESS: 'agent@example.com' as string | undefined,
    GOOGLE_SA_JSON: '{"client_email":"svc@example.com"}' as string | undefined,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: undefined as string | undefined,
    GOOGLE_SERVICE_ACCOUNT_KEY: undefined as string | undefined,
  },
  mockDb: {
    session: { count: vi.fn() },
    message: { count: vi.fn(), findFirst: vi.fn() },
    auditLog: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('@/lib/config', () => ({ env: mockEnv }));
vi.mock('@/lib/db/client', () => ({ db: mockDb }));

describe('GET /api/admin/webhooks/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.session.count.mockResolvedValue(3);
    mockDb.message.count.mockResolvedValue(7);
    mockDb.message.findFirst.mockResolvedValue({ createdAt: new Date('2026-04-21T10:00:00Z') });
    mockDb.auditLog.count.mockResolvedValue(0);
    mockDb.auditLog.findFirst.mockResolvedValue(null);
    mockDb.auditLog.findMany.mockResolvedValue([]);
  });

  it('returns 401 without a valid admin key', async () => {
    const { GET } = await import('../admin/webhooks/health/route');
    const response = await GET(new Request('http://localhost/api/admin/webhooks/health'));
    expect(response.status).toBe(401);
  });

  it('returns channel webhook health for a valid admin key', async () => {
    const { GET } = await import('../admin/webhooks/health/route');
    const response = await GET(
      new Request('http://localhost/api/admin/webhooks/health', {
        headers: { 'x-api-key': 'test-admin-key' },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.channels).toHaveLength(3);
    expect(body.channels[0].recentMessages).toBe(7);
    expect(body.channels[0].receivedCount).toBe(0);
    expect(body.status).toBe('ok');
  });

  it('surfaces logged webhook failures', async () => {
    mockDb.auditLog.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValue(0);
    mockDb.auditLog.findFirst.mockResolvedValueOnce({ createdAt: new Date('2026-04-21T11:00:00Z') });
    mockDb.auditLog.findMany.mockResolvedValueOnce([
      { createdAt: new Date('2026-04-21T11:00:00Z'), details: { reason: 'invalid_signature' } },
    ]);

    const { GET } = await import('../admin/webhooks/health/route');
    const response = await GET(
      new Request('http://localhost/api/admin/webhooks/health', {
        headers: { 'x-api-key': 'test-admin-key' },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.channels[0].failedCount).toBe(2);
    expect(body.channels[0].recentFailures[0].message).toBe('invalid_signature');
  });
});
