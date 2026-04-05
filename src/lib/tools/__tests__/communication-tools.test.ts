/**
 * Tests for Phase 14 Communication tools:
 *   sendWhatsAppMessage, translateText, summarizeDocument, webSearch
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (must run before imports) ──────────────────────────────────

const { mockChatCreate } = vi.hoisted(() => ({
  mockChatCreate: vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
  },
}));

vi.mock('@/lib/config', () => ({
  env: {
    OPENAI_API_KEY:            'test-key',
    OPENAI_MODEL:              'gpt-4o-mini',
    WHATSAPP_PHONE_NUMBER_ID:  'test-phone-id',
    WHATSAPP_ACCESS_TOKEN:     'test-wa-token',
    WHATSAPP_API_VERSION:      'v19.0',
    BRAVE_SEARCH_API_KEY:      'test-brave-key',
  },
}));

const mockLogAuditEvent        = vi.fn().mockResolvedValue(undefined);
const mockRateLimiterConsume   = vi.fn().mockReturnValue(true);
const mockResolveTenantForUser = vi.fn().mockResolvedValue('tenant-1');
const mockResolveGoogleContext = vi.fn().mockResolvedValue({ config: {}, auth: {} });
const mockGetFileById          = vi.fn();
const mockGetFileContent       = vi.fn();
const mockGetMessage           = vi.fn();
const mockListMessages         = vi.fn();
const mockUserFindUnique       = vi.fn();
const mockFetch                = vi.fn();

vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

vi.mock('@/lib/actions/rate-limiter', () => ({
  actionRateLimiter: { consume: (...a: unknown[]) => mockRateLimiterConsume(...a) },
}));

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext:  (...a: unknown[]) => mockResolveGoogleContext(...a),
  resolveTenantForUser:  (...a: unknown[]) => mockResolveTenantForUser(...a),
  resolveTenantForContext: (...a: unknown[]) => mockResolveTenantForUser(...a),
}));

vi.mock('@/lib/google/drive', () => ({
  getFileById:    (...a: unknown[]) => mockGetFileById(...a),
  getFileContent: (...a: unknown[]) => mockGetFileContent(...a),
}));

vi.mock('@/lib/google/gmail', () => ({
  getMessage:   (...a: unknown[]) => mockGetMessage(...a),
  listMessages: (...a: unknown[]) => mockListMessages(...a),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

vi.stubGlobal('fetch', mockFetch);

// ─── Import tools ─────────────────────────────────────────────────────────────

import '@/lib/tools/send-whatsapp-message';
import '@/lib/tools/translate-text';
import '@/lib/tools/summarize-document';
import '@/lib/tools/web-search';
import '@/lib/tools/read-gmail';
import { toolRegistry } from '@/lib/tools/registry';
import type { ToolContext } from '@/lib/tools/types';

// ─── Contexts ────────────────────────────────────────────────────────────────

const ctx: ToolContext = {
  sessionId: 'sess-1',
  userId:    'user-1',
  scopes:    ['whatsapp:send', 'drive:read', 'gmail:read'],
};

const anonCtx: ToolContext = { sessionId: 'sess-anon', scopes: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimiterConsume.mockReturnValue(true);
  mockResolveTenantForUser.mockResolvedValue('tenant-1');
  mockResolveGoogleContext.mockResolvedValue({ config: {}, auth: {} });
  mockUserFindUnique.mockResolvedValue({ email: 'user@test.org' });
  mockChatCreate.mockResolvedValue({ choices: [{ message: { content: '' } }] });
});

// ─── sendWhatsAppMessage ──────────────────────────────────────────────────────

describe('sendWhatsAppMessage', () => {
  const tool = toolRegistry.get('sendWhatsAppMessage')!;

  it('is registered with whatsapp:send scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('whatsapp:send');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({ to: '50938001234', message: 'Hello' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns rate-limit error when limiter rejects', async () => {
    mockRateLimiterConsume.mockReturnValueOnce(false);
    const result = await tool.handler({ to: '50938001234', message: 'Hello' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('rate limit');
  });

  it('sends a message and returns messageId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.abc123' }] }),
    });
    const result = await tool.handler({ to: '50938001234', message: 'Hello from Sandra' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { messageId: string; to: string };
    expect(data.messageId).toBe('wamid.abc123');
    expect(data.to).toBe('50938001234');
  });

  it('returns error when WhatsApp API fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) });
    const result = await tool.handler({ to: '50938001234', message: 'Hi' }, ctx);
    expect(result.success).toBe(false);
  });
});

// ─── translateText ────────────────────────────────────────────────────────────

describe('translateText', () => {
  const tool = toolRegistry.get('translateText')!;

  it('is registered with no required scopes (public)', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toHaveLength(0);
  });

  it('rejects missing text', async () => {
    await expect(tool.handler({ targetLanguage: 'fr' }, anonCtx)).rejects.toThrow();
  });

  it('rejects missing targetLanguage', async () => {
    await expect(tool.handler({ text: 'Hello' }, anonCtx)).rejects.toThrow();
  });

  it('translates text and returns result', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Bonjour' } }],
    });
    const result = await tool.handler({ text: 'Hello', targetLanguage: 'fr' }, anonCtx);
    expect(result.success).toBe(true);
    const data = result.data as { translation: string; targetLanguage: string; original: string };
    expect(data.translation).toBe('Bonjour');
    expect(data.targetLanguage).toBe('fr');
    expect(data.original).toBe('Hello');
  });

  it('returns error when OpenAI returns empty result', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
    });
    const result = await tool.handler({ text: 'Hello', targetLanguage: 'ht' }, anonCtx);
    expect(result.success).toBe(false);
  });
});

// ─── summarizeDocument ────────────────────────────────────────────────────────

describe('summarizeDocument', () => {
  const tool = toolRegistry.get('summarizeDocument')!;

  it('is registered', () => {
    expect(tool).toBeDefined();
  });

  it('rejects missing type', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('summarizes a Drive document', async () => {
    mockGetFileById.mockResolvedValueOnce({
      id: 'f-1', name: 'Report.docx', mimeType: 'application/vnd.google-apps.document',
    });
    mockGetFileContent.mockResolvedValueOnce({ text: 'This is a long document about sandras progress.' });
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Sandra has made great progress.' } }],
    });
    const result = await tool.handler({ type: 'drive', id: 'f-1' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { summary: string };
    expect(data.summary).toBe('Sandra has made great progress.');
  });

  it('summarizes a URL using fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body>Page content here</body></html>',
    });
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'A page about things.' } }],
    });
    const result = await tool.handler({ type: 'url', url: 'https://example.com' }, anonCtx);
    expect(result.success).toBe(true);
  });
});

// ─── webSearch ────────────────────────────────────────────────────────────────

describe('webSearch', () => {
  const tool = toolRegistry.get('webSearch')!;

  it('is registered with no required scopes (public)', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toHaveLength(0);
  });

  it('rejects missing query', async () => {
    await expect(tool.handler({}, anonCtx)).rejects.toThrow();
  });

  it('returns search results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: 'EdLight', url: 'https://edlight.org', description: 'An education platform.', page_age: '1d' },
            { title: 'Sandra AI', url: 'https://sandra.edlight.org', description: 'AI assistant.', page_age: '2d' },
          ],
        },
      }),
    });
    const result = await tool.handler({ query: 'EdLight platform' }, anonCtx);
    expect(result.success).toBe(true);
    const data = result.data as { results: Array<{ title: string; url: string }> };
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0]?.title).toBe('EdLight');
  });

  it('returns empty results gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    });
    const result = await tool.handler({ query: 'xyzzy gibberish' }, anonCtx);
    expect(result.success).toBe(true);
    const data = result.data as { results: unknown[] };
    expect(data.results).toHaveLength(0);
  });
});

// ─── readGmail ────────────────────────────────────────────────────────────────

describe('readGmail', () => {
  const tool = toolRegistry.get('readGmail')!;

  it('is registered with gmail:read scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('gmail:read');
  });

  it('returns error for anonymous users', async () => {
    const result = await tool.handler({}, anonCtx);
    expect(result.success).toBe(false);
  });

  it('returns error when user has no email address', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const result = await tool.handler({ query: 'is:unread' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No email address');
  });

  it('lists inbox messages', async () => {
    mockListMessages.mockResolvedValueOnce([
      { id: 'msg-1', threadId: 'th-1', subject: 'Meeting tomorrow', from: 'boss@test.org', snippet: 'Can we meet?', date: '2026-04-03' },
      { id: 'msg-2', threadId: 'th-2', subject: 'Invoice #123',    from: 'billing@test.org', snippet: 'Please find attached', date: '2026-04-02' },
    ]);
    const result = await tool.handler({ query: 'is:unread', maxResults: 5 }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { messages: unknown[]; message: string };
    expect(data.messages).toHaveLength(2);
    expect(data.message).toContain('2');
  });

  it('returns a helpful message when inbox is empty', async () => {
    mockListMessages.mockResolvedValueOnce([]);
    const result = await tool.handler({ query: 'is:unread' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { messages: unknown[] };
    expect(data.messages).toHaveLength(0);
  });

  it('fetches a single message by id', async () => {
    mockGetMessage.mockResolvedValueOnce({
      id: 'msg-42', subject: 'Your application', from: 'admissions@uni.edu',
      body: 'Congratulations, you have been accepted.', date: '2026-04-01',
    });
    const result = await tool.handler({ messageId: 'msg-42' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { message: { id: string; subject: string } };
    expect(data.message.id).toBe('msg-42');
    expect(data.message.subject).toBe('Your application');
  });

  it('supports label filtering', async () => {
    mockListMessages.mockResolvedValueOnce([
      { id: 'msg-3', subject: 'Sent item', from: 'user@test.org', snippet: 'Hi', date: '2026-04-01' },
    ]);
    const result = await tool.handler({ labelIds: ['SENT'], maxResults: 10 }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { messages: unknown[] };
    expect(data.messages).toHaveLength(1);
  });
});
