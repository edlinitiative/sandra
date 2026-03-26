import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatCompletionResponse } from '@/lib/ai/types';

// ── Mock setup ───────────────────────────────────────────────────────────────

const { mockChatCompletion, mockStreamChatCompletion } = vi.hoisted(() => ({
  mockChatCompletion: vi.fn(),
  mockStreamChatCompletion: vi.fn(),
}));

const sessions = new Map<string, { history: Array<{ role: string; content: string; timestamp: Date }> }>();

// Simulated in-memory session store
const mockSessionStore = {
  getContextMessages: vi.fn(async (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) return [];
    return session.history.map((e) => ({ role: e.role, content: e.content }));
  }),
  addEntry: vi.fn(async (sessionId: string, entry: { role: string; content: string; timestamp: Date }) => {
    if (!sessions.has(sessionId)) sessions.set(sessionId, { history: [] });
    sessions.get(sessionId)!.history.push(entry);
  }),
};

vi.mock('@/lib/ai', () => ({
  getAIProvider: () => ({
    chatCompletion: mockChatCompletion,
    streamChatCompletion: mockStreamChatCompletion,
  }),
}));

vi.mock('@/lib/memory/session-store', () => ({
  getSessionStore: () => mockSessionStore,
}));

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({ getMemorySummary: vi.fn().mockResolvedValue('') }),
}));

vi.mock('@/lib/memory/session-insights', () => ({
  getSessionContinuityContext: vi.fn().mockResolvedValue({
    memorySummary: '',
    conversationSummary: '',
  }),
  rememberConversationInsights: vi.fn().mockResolvedValue(undefined),
  refreshConversationSummary: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/knowledge', () => ({
  retrieveContext: vi.fn().mockResolvedValue([]),
  formatRetrievalContext: vi.fn().mockReturnValue(''),
  inferKnowledgeQueryContext: vi.fn().mockReturnValue({ minScore: 0.2 }),
}));

vi.mock('@/lib/tools', () => ({
  toolRegistry: {
    getToolDefinitions: vi.fn().mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search the knowledge base', parameters: {} },
    ]),
    getToolNames: vi.fn().mockReturnValue(['searchKnowledgeBase']),
  },
  executeTool: vi.fn().mockResolvedValue({ success: true, data: { results: ['EdLight Academy info'] } }),
}));

import { runSandraAgent, runSandraAgentStream } from '../sandra';
import type { AgentInput } from '../types';

function makeResponse(overrides: Partial<ChatCompletionResponse> = {}): ChatCompletionResponse {
  return {
    content: 'Hello!',
    toolCalls: [],
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    model: 'claude-3-5-sonnet',
    ...overrides,
  };
}

describe('Agent integration: full pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessions.clear();
    mockSessionStore.getContextMessages.mockClear();
    mockSessionStore.addEntry.mockClear();
    // Re-implement mocks that use session state
    mockSessionStore.getContextMessages.mockImplementation(async (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) return [];
      return session.history.map((e) => ({ role: e.role as 'user' | 'assistant', content: e.content }));
    });
    mockSessionStore.addEntry.mockImplementation(async (sessionId: string, entry: { role: string; content: string; timestamp: Date }) => {
      if (!sessions.has(sessionId)) sessions.set(sessionId, { history: [] });
      sessions.get(sessionId)!.history.push(entry);
    });
  });

  it('full pipeline: InboundMessage-style input → OutboundMessage-style output with session persistence', async () => {
    mockChatCompletion.mockResolvedValue(makeResponse({ content: 'Welcome to EdLight!' }));

    const input: AgentInput = {
      message: 'Tell me about EdLight',
      sessionId: 'integration-session-1',
      language: 'en',
      channel: 'web',
    };

    const output = await runSandraAgent(input);

    expect(output.response).toBe('Welcome to EdLight!');
    expect(output.language).toBe('en');

    // Session should have user + assistant messages
    const history = sessions.get('integration-session-1')!.history;
    expect(history).toHaveLength(2);
    expect(history[0]?.role).toBe('user');
    expect(history[1]?.role).toBe('assistant');
  });

  it('agent uses searchKnowledgeBase tool when LLM requests it', async () => {
    const { executeTool } = await import('@/lib/tools');

    const toolCallResponse = makeResponse({
      content: null,
      toolCalls: [{ id: 'c1', name: 'searchKnowledgeBase', arguments: '{"query":"EdLight Academy"}' }],
      finishReason: 'tool_calls',
    });
    const finalResponse = makeResponse({ content: 'EdLight Academy is an educational platform.' });

    mockChatCompletion
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(finalResponse);

    const output = await runSandraAgent({
      message: 'What is EdLight Academy?',
      sessionId: 'integration-session-2',
      language: 'en',
      channel: 'web',
    });

    expect(executeTool).toHaveBeenCalledWith(
      'searchKnowledgeBase',
      { query: 'EdLight Academy' },
      expect.objectContaining({ sessionId: 'integration-session-2' }),
    );
    expect(output.toolsUsed).toContain('searchKnowledgeBase');
    expect(output.response).toBe('EdLight Academy is an educational platform.');
  });

  it('session context is loaded and passed to LLM on follow-up messages', async () => {
    // First message
    mockChatCompletion.mockResolvedValueOnce(makeResponse({ content: 'Hello, I am Sandra.' }));
    await runSandraAgent({
      message: 'Who are you?',
      sessionId: 'integration-session-3',
      language: 'en',
      channel: 'web',
    });

    // Second message — should have history
    mockChatCompletion.mockResolvedValueOnce(makeResponse({ content: 'I already told you!' }));
    await runSandraAgent({
      message: 'Tell me again',
      sessionId: 'integration-session-3',
      language: 'en',
      channel: 'web',
    });

    // Second LLM call should include the history from the first exchange
    const secondCallArgs = mockChatCompletion.mock.calls[1]![0];
    const messageContents = secondCallArgs.messages.map((m: { content: string }) => m.content);
    expect(messageContents).toContain('Who are you?');
    expect(messageContents).toContain('Hello, I am Sandra.');
  });

  it('streaming variant yields events in correct order', async () => {
    async function* fakeStream() {
      yield { content: 'Hello ', toolCalls: null, done: false };
      yield { content: 'from Sandra!', toolCalls: null, done: false };
      yield { content: null, toolCalls: [], done: true };
    }
    mockStreamChatCompletion.mockReturnValue(fakeStream());

    const events = [];
    for await (const event of runSandraAgentStream({
      message: 'Hi',
      sessionId: 'stream-session',
      language: 'en',
      channel: 'web',
    })) {
      events.push(event);
    }

    const types = events.map((e) => e.type);
    expect(types).toContain('token');
    expect(types[types.length - 1]).toBe('done');
    expect(types.indexOf('token')).toBeLessThan(types.indexOf('done'));
  });
});
