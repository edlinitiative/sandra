import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions so they're available in vi.mock factory
const { mockGetContextMessages, mockGetMemorySummary, mockGetToolDefinitions } = vi.hoisted(() => ({
  mockGetContextMessages: vi.fn(),
  mockGetMemorySummary: vi.fn(),
  mockGetToolDefinitions: vi.fn(),
}));

vi.mock('@/lib/memory/session-store', () => ({
  getSessionStore: () => ({ getContextMessages: mockGetContextMessages }),
}));

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({ getMemorySummary: mockGetMemorySummary }),
}));

vi.mock('@/lib/tools', () => ({
  toolRegistry: { getToolDefinitions: mockGetToolDefinitions },
}));

import { assembleContext } from '../context';

describe('assembleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContextMessages.mockResolvedValue([]);
    mockGetMemorySummary.mockResolvedValue('');
    mockGetToolDefinitions.mockReturnValue([]);
  });

  it('returns AgentContext with all three fields', async () => {
    const ctx = await assembleContext({ sessionId: 's1', language: 'en' });
    expect(ctx).toHaveProperty('systemPrompt');
    expect(ctx).toHaveProperty('messageHistory');
    expect(ctx).toHaveProperty('tools');
  });

  it('loads message history from session store', async () => {
    mockGetContextMessages.mockResolvedValue([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);

    const ctx = await assembleContext({ sessionId: 's1', language: 'en' });
    expect(ctx.messageHistory).toHaveLength(2);
    expect(ctx.messageHistory[0]).toMatchObject({ role: 'user', content: 'hello' });
  });

  it('loads tool definitions from registry', async () => {
    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search KB', parameters: {} },
    ]);

    const ctx = await assembleContext({ sessionId: 's1', language: 'en' });
    expect(ctx.tools).toHaveLength(1);
    expect(ctx.tools[0]?.name).toBe('searchKnowledgeBase');
  });

  it('includes memory summary in system prompt when userId provided', async () => {
    mockGetMemorySummary.mockResolvedValue('User prefers French.');

    const ctx = await assembleContext({ sessionId: 's1', language: 'en', userId: 'u1' });
    expect(ctx.systemPrompt).toContain('User prefers French.');
  });

  it('does not call user memory store when no userId', async () => {
    await assembleContext({ sessionId: 's1', language: 'en' });
    expect(mockGetMemorySummary).not.toHaveBeenCalled();
  });

  it('returns empty history for unknown session', async () => {
    mockGetContextMessages.mockResolvedValue([]);

    const ctx = await assembleContext({ sessionId: 'unknown', language: 'en' });
    expect(ctx.messageHistory).toEqual([]);
  });

  it('includes language instruction in system prompt', async () => {
    const ctxFr = await assembleContext({ sessionId: 's1', language: 'fr' });
    expect(ctxFr.systemPrompt).toContain('French');
  });
});
