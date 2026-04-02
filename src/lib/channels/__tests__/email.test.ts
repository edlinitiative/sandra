import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/config', () => ({
  env: {
    SENDGRID_API_KEY: 'SG.test-key',
    SENDGRID_FROM_EMAIL: 'sandra@edlight.ht',
    SENDGRID_FROM_NAME: 'Sandra — EdLight',
  },
}));

vi.mock('@/lib/utils', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EmailChannelAdapter', () => {
  let adapter: import('../email').EmailChannelAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { EmailChannelAdapter } = await import('../email');
    adapter = new EmailChannelAdapter();
  });

  describe('isConfigured()', () => {
    it('returns true when both key and from email are set', () => {
      expect(adapter.isConfigured()).toBe(true);
    });
  });

  describe('parseInbound()', () => {
    it('parses SendGrid inbound parse fields', async () => {
      const fields = {
        from: 'Alice Dupont <alice@example.com>',
        to: 'sandra@edlight.ht',
        subject: 'Question about programs',
        text: 'What scholarships are available?',
        'message-id': '<msg-001@example.com>',
      };

      const msg = await adapter.parseInbound(fields);

      expect(msg.channelType).toBe('email');
      expect(msg.channelUserId).toBe('alice@example.com');
      expect(msg.content).toContain('What scholarships are available?');
      expect(msg.content).toContain('Question about programs');
      expect(msg.metadata?.fromName).toBe('Alice Dupont');
    });

    it('throws SKIP for empty body', async () => {
      const fields = {
        from: 'alice@example.com',
        to: 'sandra@edlight.ht',
        subject: 'Re: previous',
        text: '',
      };
      await expect(adapter.parseInbound(fields)).rejects.toThrow('SKIP:');
    });

    it('throws for missing from address', async () => {
      await expect(adapter.parseInbound({ from: '', text: 'Hello' }))
        .rejects.toThrow('missing sender address');
    });

    it('does not prefix subject on reply subjects (Re:)', async () => {
      const fields = {
        from: 'bob@example.com',
        subject: 'Re: your answer',
        text: 'Follow-up question',
      };
      const msg = await adapter.parseInbound(fields);
      // Should not double-prefix with "Subject: Re:"
      expect(msg.content).toBe('Follow-up question');
    });
  });

  describe('formatOutbound()', () => {
    it('builds a SendGrid mail body with correct fields', async () => {
      const body = await adapter.formatOutbound({
        channelType: 'email',
        recipientId: 'user@example.com',
        content: 'Here is your answer.',
        language: 'en',
        metadata: { subject: 'Question' },
      }) as { personalizations: Array<{ to: Array<{ email: string }> }>; from: { email: string }; subject: string };

      expect(body.personalizations[0]!.to[0]!.email).toBe('user@example.com');
      expect(body.from.email).toBe('sandra@edlight.ht');
      expect(body.subject).toBe('Re: Question');
    });

    it('uses default subject when none provided', async () => {
      const body = await adapter.formatOutbound({
        channelType: 'email',
        recipientId: 'user@example.com',
        content: 'Answer',
        language: 'en',
      }) as { subject: string };
      expect(body.subject).toBe('Your question to Sandra');
    });
  });

  describe('send()', () => {
    it('POSTs to SendGrid /v3/mail/send', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 202, text: async () => '' });

      await adapter.send({
        channelType: 'email',
        recipientId: 'user@example.com',
        content: 'Hello',
        language: 'en',
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0]! as [string, RequestInit];
      expect(url).toContain('sendgrid.com/v3/mail/send');
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer SG.test-key');
    });

    it('throws on non-202 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });

      await expect(
        adapter.send({ channelType: 'email', recipientId: 'x@x.com', content: 'Hi', language: 'en' }),
      ).rejects.toThrow('SendGrid API error: HTTP 400');
    });
  });
});
