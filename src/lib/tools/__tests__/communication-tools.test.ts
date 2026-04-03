/**
 * Tests for Phase 14 Communication tools:
 *   sendWhatsappMessage, translateText, summarizeDocument, webSearch
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/config', () => ({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: 'phone-id-123',
    WHATSAPP_ACCESS_TOKEN:    'wa-token-abc',
    OPENAI_API_KEY:           'sk-test-openai',
    BRAVE_SEARCH_API_KEY:     'brave-key-xyz',
    OPENAI_MODEL:             'gpt-4o',
  },
}));

// Mock OpenAI — chat.completions.create returns a canned response
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Bonjour le monde' } }],
        }),
      },
    },
  })),
}));

vi.mock('@/lib/google/context', () => ({
  resolveGoogleContext:  vi.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  resolveTenantForUser:  vi.fn().mockResolvedValue('tenant-1'),
}));

vi.mock('@/lib/google/drive', () => ({
  getFilesContent:   vi.fn().mockResolvedValue([]),
  getFileById:       vi.fn().mockResolvedValue(null),
  searchDriveFiles:  vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/google/gmail', () => ({
  getMessage: vi.fn().mockResolvedValue({ id: 'msg-1', subject: 'Test', body: 'Email body', from: 'a@b.com', date: '2026-04-01' }),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import tools ─────────────────────────────────────────────────────────────

import '@/lib/tools/send-whatsapp-message';
import '@/lib/tools/translate-text';
import '@/lib/tools/summarize-document';
import '@/lib/tools/web-search';
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
  // Default OpenAI mock
  const OpenAI = vi.mocked((await import('openai')).default);
  OpenAI.mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Translated text' } }],
        }),
      },
    },
  }) as never);
});

// ─── sendWhatsappMessage ──────────────────────────────────────────────────────

describe('sendWhatsappMessage', () => {
  const tool = toolRegistry.get('sendWhatsappMessage')!;

  it('is registered with whatsapp:send scope', () => {
    expect(tool).toBeDefined();
    expect(tool.requiredScopes).toContain('whatsapp:send');
  });

  it('rejects missing to/body', async () => {
    await expect(tool.handler({}, ctx)).rejects.toThrow();
  });

  it('sends message and returns message id on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.abc123' }] }),
    });

    const result = await tool.handler(
      { to: '+50912345678', body: 'Hello from Sandra!' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect((result.data as { messageId: string }).messageId).toBe('wamid.abc123');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('phone-id-123'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns error when WhatsApp API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid phone number' } }),
    });

    const result = await tool.handler(
      { to: '+509invalid', body: 'Hi' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error when no userId', async () => {
    const result = await tool.handler({ to: '+50912345678', body: 'Hi' }, anonCtx);
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

  it('translates text and returns result', async () => {
    const result = await tool.handler(
      { text: 'Hello world', targetLanguage: 'fr' },
      anonCtx,
    );
    expect(result.success).toBe(true);
    const data = result.data as { translatedText: string; targetLanguage: string };
    expect(typeof data.translatedText).toBe('string');
    expect(data.targetLanguage).toBe('fr');
  });

  it('defaults to Haitian Creole when no targetLanguage given', async () => {
    const result = await tool.handler({ text: 'Hello' }, anonCtx);
    expect(result.success).toBe(true);
    expect((result.data as { targetLanguage: string }).targetLanguage).toBe('ht');
  });

  it('rejects unsupported language code', async () => {
    await expect(
      tool.handler({ text: 'Hello', targetLanguage: 'xyz' }, anonCtx),
    ).rejects.toThrow();
  });
});

// ─── summarizeDocument ────────────────────────────────────────────────────────

describe('summarizeDocument', () => {
  const tool = toolRegistry.get('summarizeDocument')!;

  it('is registered', () => {
    expect(tool).toBeDefined();
  });

  it('rejects missing source', async () => {
    await expect(tool.handler({}, anonCtx)).rejects.toThrow();
  });

  it('summarizes a gmail message', async () => {
    const result = await tool.handler(
      { source: 'gmail', sourceId: 'msg-1' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect((result.data as { summary: string }).summary).toBeTruthy();
  });

  it('fetches URL and summarizes content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body><p>This is the article body.</p></body></html>',
      headers: { get: () => 'text/html' },
    });

    const result = await tool.handler(
      { source: 'url', sourceId: 'https://example.com/article' },
      anonCtx,
    );
    expect(result.success).toBe(true);
  });

  it('returns error when Gmail source requires userId', async () => {
    const result = await tool.handler(
      { source: 'gmail', sourceId: 'msg-1' },
      anonCtx,
    );
    expect(result.success).toBe(false);
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

  it('returns search results from Brave API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: 'EdLight Academy', url: 'https://edlight.org', description: 'Premier AI platform in Haiti' },
            { title: 'Sandra AI', url: 'https://edlight.org/sandra', description: 'AI assistant' },
          ],
        },
      }),
    });

    const result = await tool.handler({ query: 'EdLight Haiti education' }, anonCtx);
    expect(result.success).toBe(true);
    const data = result.data as { results: Array<{ title: string }> };
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0].title).toBe('EdLight Academy');
  });

  it('returns error when Brave API key is missing', async () => {
    vi.doMock('@/lib/config', () => ({
      env: {
        WHATSAPP_PHONE_NUMBER_ID: 'phone-id-123',
        WHATSAPP_ACCESS_TOKEN:    'wa-token-abc',
        OPENAI_API_KEY:           'sk-test-openai',
        BRAVE_SEARCH_API_KEY:     undefined,
        OPENAI_MODEL:             'gpt-4o',
      },
    }));

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const result = await tool.handler({ query: 'test' }, anonCtx);
    expect(result.success).toBe(false);
  });

  it('passes count and language parameters to API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    });

    await tool.handler({ query: 'news Haiti', count: 3, language: 'fr' }, anonCtx);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('count=3');
  });
});
