import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSendEmail = vi.fn().mockResolvedValue({ messageId: 'msg-1', threadId: 'thr-1', labelIds: [] });
const mockReplyToMessage = vi.fn().mockResolvedValue({ messageId: 'msg-2', threadId: 'thr-1', labelIds: [] });
const mockResolveGoogleContext = vi.fn().mockResolvedValue({ tenantId: 'tenant-1', credentials: {}, config: {} });

vi.mock('@/lib/google/gmail', () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
  replyToMessage: (...a: unknown[]) => mockReplyToMessage(...a),
}));

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext: (...a: unknown[]) => mockResolveGoogleContext(...a),
}));

vi.mock('@/lib/config', () => ({
  env: {
    SANDRA_EMAIL_ADDRESS: 'sandra@edlight.org',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sa@edlight.iam.gserviceaccount.com',
    GOOGLE_SERVICE_ACCOUNT_KEY: 'base64key',
    GOOGLE_WORKSPACE_DOMAIN: 'edlight.org',
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
    it('returns true when service account credentials are set', () => {
      expect(adapter.isConfigured()).toBe(true);
    });
  });

  describe('sandraEmail', () => {
    it('returns the SANDRA_EMAIL_ADDRESS env var', () => {
      expect(adapter.sandraEmail).toBe('sandra@edlight.org');
    });
  });

  describe('parseInbound()', () => {
    it('parses raw form-data fields', async () => {
      const fields = {
        from: 'Alice Dupont <alice@example.com>',
        to: 'sandra@edlight.org',
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
        to: 'sandra@edlight.org',
        subject: 'Re: previous',
        text: '',
      };
      await expect(adapter.parseInbound(fields)).rejects.toThrow('SKIP:');
    });

    it('throws for missing from address', async () => {
      await expect(adapter.parseInbound({ from: '', text: 'Hello' }))
        .rejects.toThrow('missing sender address');
    });

    it('does not prefix content on Re: subjects', async () => {
      const fields = { from: 'bob@example.com', subject: 'Re: your answer', text: 'Follow-up' };
      const msg = await adapter.parseInbound(fields);
      expect(msg.content).toBe('Follow-up');
    });
  });

  describe('parseGmailMessage()', () => {
    it('converts a GmailMessage into a normalised InboundMessage', () => {
      const gmailMsg = {
        messageId: 'gm-123',
        threadId: 'thr-456',
        from: 'Marie Jean <marie@example.com>',
        to: ['sandra@edlight.org'],
        subject: 'Hello Sandra',
        snippet: 'Short preview',
        body: 'Full body text here',
        date: new Date().toUTCString(),
        labelIds: ['INBOX', 'UNREAD'],
      };

      const msg = adapter.parseGmailMessage(gmailMsg);

      expect(msg.channelType).toBe('email');
      expect(msg.channelUserId).toBe('marie@example.com');
      expect(msg.metadata?.fromName).toBe('Marie Jean');
      expect(msg.metadata?.gmailThreadId).toBe('thr-456');
      expect(msg.content).toContain('Full body text here');
    });

    it('throws SKIP when body and snippet are both empty', () => {
      const gmailMsg = {
        messageId: 'gm-empty',
        threadId: 'thr-empty',
        from: 'x@example.com',
        to: ['sandra@edlight.org'],
        subject: 'Re: previous',
        snippet: '',
        body: '',
        date: new Date().toUTCString(),
        labelIds: ['UNREAD'],
      };
      expect(() => adapter.parseGmailMessage(gmailMsg)).toThrow('SKIP:');
    });
  });

  describe('send()', () => {
    it('calls replyToMessage when threadId and messageId are present', async () => {
      await adapter.send({
        channelType: 'email',
        recipientId: 'user@example.com',
        content: 'Here is your answer.',
        language: 'en',
        metadata: { subject: 'Question', emailMessageId: 'orig-id', gmailThreadId: 'thr-789' },
      });

      expect(mockReplyToMessage).toHaveBeenCalledOnce();
      expect(mockSendEmail).not.toHaveBeenCalled();
      const call = mockReplyToMessage.mock.calls[0]![1] as Record<string, unknown>;
      expect(call.to).toEqual(['user@example.com']);
      expect(call.subject).toBe('Re: Question');
    });

    it('calls sendEmail when no threadId is available (first contact)', async () => {
      await adapter.send({
        channelType: 'email',
        recipientId: 'newuser@example.com',
        content: 'Welcome!',
        language: 'en',
        metadata: { subject: 'Intro' },
      });

      expect(mockSendEmail).toHaveBeenCalledOnce();
      expect(mockReplyToMessage).not.toHaveBeenCalled();
    });
  });
});
