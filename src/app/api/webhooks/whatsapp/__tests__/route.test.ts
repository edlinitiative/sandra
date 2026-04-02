import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WhatsAppWebhookPayload } from '@/lib/channels/whatsapp';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockGetWhatsAppAdapter,
  mockIsConfigured,
  mockVerifyWebhook,
  mockParseInbound,
  mockMarkAsRead,
  mockSend,
} = vi.hoisted(() => {
  const mockIsConfigured = vi.fn().mockReturnValue(true);
  const mockVerifyWebhook = vi.fn();
  const mockParseInbound = vi.fn();
  const mockMarkAsRead = vi.fn().mockResolvedValue(undefined);
  const mockSend = vi.fn().mockResolvedValue(undefined);

  const adapter = {
    isConfigured: mockIsConfigured,
    verifyWebhook: mockVerifyWebhook,
    parseInbound: mockParseInbound,
    markAsRead: mockMarkAsRead,
    send: mockSend,
  };

  return {
    mockGetWhatsAppAdapter: vi.fn().mockReturnValue(adapter),
    mockIsConfigured,
    mockVerifyWebhook,
    mockParseInbound,
    mockMarkAsRead,
    mockSend,
  };
});

const { mockResolveChannelIdentity } = vi.hoisted(() => ({
  mockResolveChannelIdentity: vi.fn(),
}));

const { mockGetOrCreateSessionForChannel, mockEnsureSessionContinuity } = vi.hoisted(() => ({
  mockGetOrCreateSessionForChannel: vi.fn(),
  mockEnsureSessionContinuity: vi.fn(),
}));

const { mockRunSandraAgent } = vi.hoisted(() => ({
  mockRunSandraAgent: vi.fn(),
}));

vi.mock('@/lib/channels/whatsapp', () => ({
  getWhatsAppAdapter: mockGetWhatsAppAdapter,
}));

vi.mock('@/lib/channels/channel-identity', () => ({
  resolveChannelIdentity: mockResolveChannelIdentity,
}));

vi.mock('@/lib/memory/session-continuity', () => ({
  ensureSessionContinuity: mockEnsureSessionContinuity,
  getOrCreateSessionForChannel: mockGetOrCreateSessionForChannel,
}));

vi.mock('@/lib/agents', () => ({
  runSandraAgent: mockRunSandraAgent,
}));

vi.mock('@/lib/i18n', () => ({
  resolveLanguage: () => 'en',
}));

vi.mock('@/lib/auth', () => ({
  getScopesForRole: () => ['knowledge:read', 'repos:read'],
}));

vi.mock('@/lib/tools/resilience', () => ({
  setCorrelationId: vi.fn(),
  clearCorrelationId: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  generateRequestId: () => 'req-test-001',
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/channels/whatsapp-formatter', () => ({
  splitForWhatsApp: (text: string) => [text],
}));

// Mock @vercel/functions waitUntil — in tests just run the promise
vi.mock('@vercel/functions', () => ({
  waitUntil: (promise: Promise<unknown>) => { void promise; },
}));

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeTextPayload(): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-id',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15559990000', phone_number_id: 'test-phone-id' },
              contacts: [{ profile: { name: 'Alice' }, wa_id: '15551234567' }],
              messages: [
                {
                  id: 'wamid.abc123',
                  from: '15551234567',
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body: 'Hello Sandra' },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/webhooks/whatsapp', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/webhooks/whatsapp', () => {
  it('returns challenge when verification succeeds', async () => {
    mockVerifyWebhook.mockReturnValueOnce('mychallenge123');

    const url = 'http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=secret&hub.challenge=mychallenge123';
    const request = new Request(url, { method: 'GET' });

    const { GET } = await import('../route');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe('mychallenge123');
  });

  it('returns 403 when verification fails', async () => {
    mockVerifyWebhook.mockReturnValueOnce(null);

    const url = 'http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=xyz';
    const request = new Request(url, { method: 'GET' });

    const { GET } = await import('../route');
    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});

describe('POST /api/webhooks/whatsapp', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Restore default mocks
    mockIsConfigured.mockReturnValue(true);
    mockVerifyWebhook.mockReturnValue('challenge');
    mockResolveChannelIdentity.mockResolvedValue({
      userId: 'user-abc',
      channelIdentityId: 'ci-001',
      isNew: false,
      displayName: 'Alice',
    });
    mockGetOrCreateSessionForChannel.mockResolvedValue({
      sessionId: 'whatsapp:15551234567',
      userId: 'user-abc',
      language: 'en',
    });
    mockEnsureSessionContinuity.mockResolvedValue(undefined);
    mockRunSandraAgent.mockResolvedValue({
      response: "I'm Sandra, happy to help!",
      language: 'en',
      toolsUsed: [],
      retrievalUsed: false,
    });
  });

  it('responds 200 immediately', async () => {
    mockParseInbound.mockResolvedValueOnce({
      channelType: 'whatsapp',
      channelUserId: '15551234567',
      content: 'Hello Sandra',
      timestamp: new Date(),
      metadata: { whatsappMessageId: 'wamid.abc123', displayName: 'Alice', messageType: 'text' },
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest(makeTextPayload()));

    expect(response.status).toBe(200);
    const json = await response.json() as { status: string };
    expect(json.status).toBe('ok');
  });

  it('responds 200 even when body is not JSON', async () => {
    const badRequest = new Request('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      body: 'not-json',
    });

    const { POST } = await import('../route');
    const response = await POST(badRequest);

    expect(response.status).toBe(200);
  });
});
