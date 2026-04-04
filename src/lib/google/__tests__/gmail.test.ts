/**
 * Tests for Google Gmail service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail, createDraft } from '../gmail';
import type { GoogleWorkspaceContext, GmailDraftInput } from '../types';

vi.mock('../auth', () => ({
  getContextToken: vi.fn().mockResolvedValue('ya29.mock-token'),
  GOOGLE_SCOPES: {
    GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
    GMAIL_COMPOSE: 'https://www.googleapis.com/auth/gmail.compose',
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockCtx: GoogleWorkspaceContext = {
  tenantId: 'tenant-1',
  providerId: 'provider-1',
  credentials: {
    type: 'service_account',
    client_email: 'test@test.iam.gserviceaccount.com',
    private_key: 'fake-key',
  },
  config: { domain: 'test.org', adminEmail: 'admin@test.org' },
};

const testInput: GmailDraftInput = {
  from: 'user@test.org',
  to: ['recipient@example.com'],
  subject: 'Test Subject',
  body: 'Hello, this is a test email.',
};

describe('Google Gmail — sendEmail', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends an email via Gmail API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'msg-123',
        threadId: 'thread-456',
        labelIds: ['SENT'],
      }),
    });

    const result = await sendEmail(mockCtx, testInput);
    expect(result.messageId).toBe('msg-123');
    expect(result.threadId).toBe('thread-456');
    expect(result.labelIds).toContain('SENT');

    // Verify request
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/messages/send');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer ya29.mock-token');
  });

  it('throws on send failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Insufficient permissions',
    });

    await expect(sendEmail(mockCtx, testInput)).rejects.toThrow('Gmail send failed: 403');
  });
});

describe('Google Gmail — createDraft', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('creates a draft in the user mailbox', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'draft-789',
        message: { id: 'msg-789', threadId: 'thread-789', labelIds: ['DRAFT'] },
      }),
    });

    const result = await createDraft(mockCtx, testInput);
    expect(result.draftId).toBe('draft-789');
    expect(result.message.messageId).toBe('msg-789');

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/drafts');
  });

  it('throws on draft creation failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    });

    await expect(createDraft(mockCtx, testInput)).rejects.toThrow('Gmail draft creation failed: 400');
  });
});
