import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WhatsAppWebhookPayload } from '../whatsapp';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/config', () => ({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
    WHATSAPP_ACCESS_TOKEN: 'test-access-token',
    WHATSAPP_WEBHOOK_SECRET: 'test-webhook-secret',
    WHATSAPP_API_VERSION: 'v19.0',
  },
}));

vi.mock('@/lib/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTextPayload(overrides: Partial<{
  from: string;
  body: string;
  messageId: string;
  displayName: string;
  timestamp: number;
}> = {}): WhatsAppWebhookPayload {
  const {
    from = '15551234567',
    body = 'Hello Sandra',
    messageId = 'wamid.abc123',
    displayName = 'Alice',
    timestamp = 1700000000,
  } = overrides;

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
              contacts: [{ profile: { name: displayName }, wa_id: from }],
              messages: [
                {
                  id: messageId,
                  from,
                  timestamp: String(timestamp),
                  type: 'text',
                  text: { body },
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

function makeStatusPayload(): WhatsAppWebhookPayload {
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
              statuses: [
                {
                  id: 'wamid.status',
                  status: 'delivered',
                  timestamp: '1700000001',
                  recipient_id: '15551234567',
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WhatsAppChannelAdapter', () => {
  let adapter: import('../whatsapp').WhatsAppChannelAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { WhatsAppChannelAdapter } = await import('../whatsapp');
    adapter = new WhatsAppChannelAdapter();
  });

  describe('isConfigured()', () => {
    it('returns true when all env vars are present', () => {
      expect(adapter.isConfigured()).toBe(true);
    });
  });

  describe('verifyWebhook()', () => {
    it('returns challenge on valid subscription', () => {
      const result = adapter.verifyWebhook({
        mode: 'subscribe',
        token: 'test-webhook-secret',
        challenge: 'abc-challenge-123',
      });
      expect(result).toBe('abc-challenge-123');
    });

    it('returns null on wrong token', () => {
      const result = adapter.verifyWebhook({
        mode: 'subscribe',
        token: 'wrong-token',
        challenge: 'abc-challenge-123',
      });
      expect(result).toBeNull();
    });

    it('returns null on wrong mode', () => {
      const result = adapter.verifyWebhook({
        mode: 'unsubscribe',
        token: 'test-webhook-secret',
        challenge: 'abc-challenge-123',
      });
      expect(result).toBeNull();
    });
  });

  describe('parseInbound()', () => {
    it('parses a text message correctly', async () => {
      const payload = makeTextPayload({ from: '15551234567', body: 'Hello Sandra' });
      const msg = await adapter.parseInbound(payload);

      expect(msg.channelType).toBe('whatsapp');
      expect(msg.channelUserId).toBe('15551234567');
      expect(msg.content).toBe('Hello Sandra');
      expect(msg.metadata?.displayName).toBe('Alice');
      expect(msg.metadata?.whatsappMessageId).toBe('wamid.abc123');
      expect(msg.metadata?.messageType).toBe('text');
    });

    it('parses a button reply message', async () => {
      const payload = makeTextPayload({ body: '' });
      payload.entry[0]!.changes[0]!.value.messages![0] = {
        id: 'wamid.btn',
        from: '15551234567',
        timestamp: '1700000000',
        type: 'button',
        button: { text: 'Option A', payload: 'option_a' },
      };
      const msg = await adapter.parseInbound(payload);
      expect(msg.content).toBe('Option A');
    });

    it('returns placeholder for image messages', async () => {
      const payload = makeTextPayload();
      payload.entry[0]!.changes[0]!.value.messages![0] = {
        id: 'wamid.img',
        from: '15551234567',
        timestamp: '1700000000',
        type: 'image',
        image: { id: 'media-id', mime_type: 'image/jpeg', sha256: 'abc' },
      };
      const msg = await adapter.parseInbound(payload);
      expect(msg.content).toMatch(/\[image/i);
    });

    it('throws SKIP for delivery status payloads', async () => {
      const payload = makeStatusPayload();
      await expect(adapter.parseInbound(payload)).rejects.toThrow('SKIP:');
    });

    it('throws for non-whatsapp_business_account object', async () => {
      const payload = { object: 'instagram', entry: [] } as unknown as WhatsAppWebhookPayload;
      await expect(adapter.parseInbound(payload)).rejects.toThrow('Unexpected webhook object');
    });
  });

  describe('formatOutbound()', () => {
    it('formats a message with WhatsApp-safe text', async () => {
      const result = await adapter.formatOutbound({
        channelType: 'whatsapp',
        recipientId: '15551234567',
        content: '**Hello** from Sandra',
        language: 'en',
      });

      expect(result).toMatchObject({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '15551234567',
        type: 'text',
      });
      const body = (result as { text: { body: string } }).text.body;
      expect(body).toContain('*Hello*');
    });
  });

  describe('send()', () => {
    it('POSTs to the WhatsApp API with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ id: 'wamid.new' }] }) });

      await adapter.send({
        channelType: 'whatsapp',
        recipientId: '15551234567',
        content: 'Hello',
        language: 'en',
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toContain('v19.0');
      expect(url).toContain('test-phone-id');
      expect(url).toContain('/messages');
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-access-token');
    });

    it('throws on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid parameter' } }),
      });

      await expect(
        adapter.send({ channelType: 'whatsapp', recipientId: '15551234567', content: 'Hi', language: 'en' }),
      ).rejects.toThrow('WhatsApp API error: Invalid parameter');
    });
  });

  describe('markAsRead()', () => {
    it('calls the API (best-effort)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await adapter.markAsRead('wamid.abc123'); // should not throw
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('swallows errors silently', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await expect(adapter.markAsRead('wamid.abc')).resolves.toBeUndefined();
    });
  });
});

describe('extractWhatsAppMessages', () => {
  it('extracts all messages from all entries', async () => {
    const { extractWhatsAppMessages } = await import('../whatsapp');
    const payload = makeTextPayload({ messageId: 'msg1' });
    const messages = extractWhatsAppMessages(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.id).toBe('msg1');
  });

  it('returns empty array for payload with no messages', async () => {
    const { extractWhatsAppMessages } = await import('../whatsapp');
    const payload = makeStatusPayload();
    const messages = extractWhatsAppMessages(payload);
    expect(messages).toHaveLength(0);
  });
});

describe('getWhatsAppAdapter', () => {
  it('returns a singleton', async () => {
    const { getWhatsAppAdapter } = await import('../whatsapp');
    const a = getWhatsAppAdapter();
    const b = getWhatsAppAdapter();
    expect(a).toBe(b);
  });
});
