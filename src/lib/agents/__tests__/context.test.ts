import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions so they're available in vi.mock factory
const {
  mockGetContextMessages,
  mockGetToolDefinitions,
  mockGetSessionContinuityContext,
} = vi.hoisted(() => ({
  mockGetContextMessages: vi.fn(),
  mockGetToolDefinitions: vi.fn(),
  mockGetSessionContinuityContext: vi.fn(),
}));

vi.mock('@/lib/memory/session-store', () => ({
  getSessionStore: () => ({ getContextMessages: mockGetContextMessages }),
}));

vi.mock('@/lib/memory/session-insights', () => ({
  getSessionContinuityContext: mockGetSessionContinuityContext,
}));

vi.mock('@/lib/tools', () => ({
  toolRegistry: { getToolDefinitions: mockGetToolDefinitions },
}));

import { assembleContext } from '../context';

describe('assembleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContextMessages.mockResolvedValue([]);
    mockGetToolDefinitions.mockReturnValue([]);
    mockGetSessionContinuityContext.mockResolvedValue({
      memorySummary: '',
      conversationSummary: '',
    });
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
    mockGetSessionContinuityContext.mockResolvedValue({
      memorySummary: 'User prefers French.',
      conversationSummary: '',
    });

    const ctx = await assembleContext({ sessionId: 's1', language: 'en', userId: 'u1' });
    expect(ctx.systemPrompt).toContain('User prefers French.');
  });

  it('loads session continuity context even when no userId is provided', async () => {
    await assembleContext({ sessionId: 's1', language: 'en' });
    expect(mockGetSessionContinuityContext).toHaveBeenCalledWith({
      sessionId: 's1',
      userId: undefined,
    });
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

  it('includes conversation summary in the system prompt when available', async () => {
    mockGetSessionContinuityContext.mockResolvedValue({
      memorySummary: '',
      conversationSummary: 'Earlier conversation summary:\n- Earlier user questions/goals: Learn Python',
    });

    const ctx = await assembleContext({ sessionId: 's1', language: 'en' });
    expect(ctx.systemPrompt).toContain('Earlier conversation summary');
    expect(ctx.systemPrompt).toContain('Learn Python');
  });
});
