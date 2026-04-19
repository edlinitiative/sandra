import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InstagramWebhookPayload } from '../instagram';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/config', () => ({
  env: {
    INSTAGRAM_PAGE_ACCESS_TOKEN: 'test-ig-token',
    INSTAGRAM_VERIFY_TOKEN: 'test-ig-verify',
    INSTAGRAM_API_VERSION: 'v19.0',
  },
}));

vi.mock('@/lib/utils', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTextPayload(overrides: Partial<{
  psid: string;
  text: string;
  mid: string;
  timestamp: number;
}> = {}): InstagramWebhookPayload {
  const {
    psid = 'psid-12345',
    text = 'Hello Sandra',
    mid = 'mid.abc123',
    timestamp = 1700000000000,
  } = overrides;

  return {
    object: 'instagram',
    entry: [
      {
        id: 'page-id',
        time: timestamp,
        messaging: [
          {
            sender: { id: psid },
            recipient: { id: 'page-id' },
            timestamp,
            message: { mid, text },
          },
        ],
      },
    ],
  };
}

function makeEchoPayload(): InstagramWebhookPayload {
  return {
    object: 'instagram',
    entry: [
      {
        id: 'page-id',
        time: 1700000000000,
        messaging: [
          {
            sender: { id: 'page-id' },
            recipient: { id: 'psid-12345' },
            timestamp: 1700000000000,
            message: { mid: 'mid.echo', text: 'echoed', is_echo: true },
          },
        ],
      },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InstagramChannelAdapter', () => {
  let adapter: import('../instagram').InstagramChannelAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { InstagramChannelAdapter } = await import('../instagram');
    adapter = new InstagramChannelAdapter();
  });

  describe('isConfigured()', () => {
    it('returns true when credentials are present', () => {
      expect(adapter.isConfigured()).toBe(true);
    });
  });

  describe('verifyWebhook()', () => {
    it('returns challenge on valid subscription', () => {
      expect(
        adapter.verifyWebhook({ mode: 'subscribe', token: 'test-ig-verify', challenge: 'xyz' }),
      ).toBe('xyz');
    });

    it('returns null on wrong token', () => {
      expect(
        adapter.verifyWebhook({ mode: 'subscribe', token: 'wrong', challenge: 'xyz' }),
      ).toBeNull();
    });

    it('returns null on wrong mode', () => {
      expect(
        adapter.verifyWebhook({ mode: 'unsubscribe', token: 'test-ig-verify', challenge: 'xyz' }),
      ).toBeNull();
    });
  });

  describe('parseInbound()', () => {
    it('parses a text DM correctly', async () => {
      const payload = makeTextPayload({ psid: 'psid-12345', text: 'Hello Sandra' });
      const msg = await adapter.parseInbound(payload);

      expect(msg.channelType).toBe('instagram');
      expect(msg.channelUserId).toBe('psid-12345');
      expect(msg.content).toBe('Hello Sandra');
      expect(msg.metadata?.messageType).toBe('message');
    });

    it('throws SKIP for echo messages', async () => {
      await expect(adapter.parseInbound(makeEchoPayload())).rejects.toThrow('SKIP: Echo message');
    });

    it('throws SKIP when no messaging events', async () => {
      const payload: InstagramWebhookPayload = { object: 'instagram', entry: [{ id: 'x', time: 0 }] };
      await expect(adapter.parseInbound(payload)).rejects.toThrow('SKIP:');
    });

    it('throws for non-instagram object', async () => {
      const payload = { object: 'whatsapp_business_account', entry: [] } as unknown as InstagramWebhookPayload;
      await expect(adapter.parseInbound(payload)).rejects.toThrow('Unexpected webhook object');
    });

    it('returns attachment placeholder for non-text messages', async () => {
      const payload = makeTextPayload({ text: undefined as unknown as string });
      payload.entry[0]!.messaging![0]!.message = {
        mid: 'mid.img',
        attachments: [{ type: 'image', payload: { url: 'https://example.com/img.jpg' } }],
      };
      const msg = await adapter.parseInbound(payload);
      expect(msg.content).toMatch(/\[image/i);
    });
  });

  describe('formatOutbound()', () => {
    it('formats a message correctly', async () => {
      const result = await adapter.formatOutbound({
        channelType: 'instagram',
        recipientId: 'psid-12345',
        content: '**Bold** text',
        language: 'en',
      });
      const body = result as { recipient: { id: string }; message: { text: string } };
      expect(body.recipient.id).toBe('psid-12345');
      expect(body.message.text).not.toContain('**');
    });
  });

  describe('send()', () => {
    it('POSTs to Instagram Graph API', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ recipient_id: 'psid-12345' }) });

      await adapter.send({
        channelType: 'instagram',
        recipientId: 'psid-12345',
        content: 'Hello',
        language: 'en',
        metadata: { pageId: 'ig-page-123' },
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0]! as [string, RequestInit];
      expect(url).toContain('graph.facebook.com');
      expect(url).toContain('v19.0');
      expect(url).toContain('ig-page-123/messages');
      expect(options.headers).toHaveProperty('Authorization', 'Bearer test-ig-token');
    });

    it('strips Markdown before sending', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await adapter.send({
        channelType: 'instagram',
        recipientId: 'psid-12345',
        content: '**Bold** and _italic_ text with `code`',
        language: 'en',
      });

      const [, options] = mockFetch.mock.calls[0]! as [string, RequestInit];
      const body = JSON.parse(options.body as string) as { message: { text: string } };
      expect(body.message.text).not.toContain('**');
      expect(body.message.text).not.toContain('_');
      expect(body.message.text).not.toContain('`');
      expect(body.message.text).toBe('Bold and italic text with code');
    });

    it('splits long content into multiple API calls', async () => {
      // Use a persistent mock (not mockResolvedValueOnce) so no stale entries
      // remain in the queue regardless of how many chunks are produced.
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      // Two paragraphs each ~799 chars; combined > 1000 so they split.
      const para1 = 'A '.repeat(400).trim();
      const para2 = 'B '.repeat(400).trim();
      const longContent = `${para1}\n\n${para2}`;

      await adapter.send({
        channelType: 'instagram',
        recipientId: 'psid-12345',
        content: longContent,
        language: 'en',
        metadata: { pageId: 'ig-page-123' },
      });

      // Content splits into 2 paragraphs → 2 API calls
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('throws on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid recipient' } }),
      });

      await expect(
        adapter.send({ channelType: 'instagram', recipientId: 'psid-12345', content: 'Hi', language: 'en' }),
      ).rejects.toThrow('Instagram API error: Invalid recipient');
    });
  });

  describe('fetchSenderProfile()', () => {
    it('returns name and username from Graph API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Ted Jacquet', username: 'tedjacquet' }),
      });

      const profile = await adapter.fetchSenderProfile('psid-12345');
      expect(profile).toEqual({ name: 'Ted Jacquet', username: 'tedjacquet' });
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0]! as [string];
      expect(url).toContain('fields=name,username');
    });

    it('returns null values when API returns partial data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Ted' }),
      });

      const profile = await adapter.fetchSenderProfile('psid-12345');
      expect(profile).toEqual({ name: 'Ted', username: null });
    });

    it('returns null values on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const profile = await adapter.fetchSenderProfile('psid-12345');
      expect(profile).toEqual({ name: null, username: null });
    });

    it('returns null values on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const profile = await adapter.fetchSenderProfile('psid-12345');
      expect(profile).toEqual({ name: null, username: null });
    });

    it('fetchSenderName delegates to fetchSenderProfile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Rony', username: 'ronyf' }),
      });

      const name = await adapter.fetchSenderName('psid-99');
      expect(name).toBe('Rony');
    });
  });
});

describe('extractInstagramMessaging', () => {
  it('extracts all messaging events', async () => {
    const { extractInstagramMessaging } = await import('../instagram');
    const payload = makeTextPayload({ mid: 'mid.001' });
    const events = extractInstagramMessaging(payload);
    expect(events).toHaveLength(1);
    expect(events[0]!.message?.mid).toBe('mid.001');
  });

  it('returns empty array for payload with no messaging', async () => {
    const { extractInstagramMessaging } = await import('../instagram');
    const payload: InstagramWebhookPayload = { object: 'instagram', entry: [{ id: 'x', time: 0 }] };
    expect(extractInstagramMessaging(payload)).toHaveLength(0);
  });
});
