import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatCompletionResponse } from '@/lib/ai/types';

// ── Mock setup ───────────────────────────────────────────────────────────────

const {
  mockChatCompletion,
  mockStreamChatCompletion,
  mockGetContextMessages,
  mockAddEntry,
  mockGetMemorySummary,
  mockRetrieveContext,
  mockFormatRetrievalContext,
  mockGetToolDefinitions,
  mockGetToolNames,
  mockExecuteTool,
} = vi.hoisted(() => ({
  mockChatCompletion: vi.fn(),
  mockStreamChatCompletion: vi.fn(),
  mockGetContextMessages: vi.fn(),
  mockAddEntry: vi.fn(),
  mockGetMemorySummary: vi.fn(),
  mockRetrieveContext: vi.fn(),
  mockFormatRetrievalContext: vi.fn(),
  mockGetToolDefinitions: vi.fn(),
  mockGetToolNames: vi.fn(),
  mockExecuteTool: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  getAIProvider: () => ({
    chatCompletion: mockChatCompletion,
    streamChatCompletion: mockStreamChatCompletion,
  }),
}));

vi.mock('@/lib/memory/session-store', () => ({
  getSessionStore: () => ({
    getContextMessages: mockGetContextMessages,
    addEntry: mockAddEntry,
  }),
}));

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({ getMemorySummary: mockGetMemorySummary }),
}));

vi.mock('@/lib/knowledge', () => ({
  retrieveContext: mockRetrieveContext,
  formatRetrievalContext: mockFormatRetrievalContext,
}));

vi.mock('@/lib/tools', () => ({
  toolRegistry: {
    getToolDefinitions: mockGetToolDefinitions,
    getToolNames: mockGetToolNames,
  },
  executeTool: mockExecuteTool,
}));

import { runSandraAgent, runSandraAgentStream } from '../sandra';
import type { AgentInput } from '../types';

const baseInput: AgentInput = {
  message: 'Hello!',
  sessionId: 'test-session',
  language: 'en',
  channel: 'web',
};

function makeCompletionResponse(overrides: Partial<ChatCompletionResponse> = {}): ChatCompletionResponse {
  return {
    content: 'Hello back!',
    toolCalls: [],
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    model: 'claude-3-5-sonnet',
    ...overrides,
  };
}

describe('runSandraAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContextMessages.mockResolvedValue([]);
    mockGetMemorySummary.mockResolvedValue('');
    mockRetrieveContext.mockResolvedValue([]);
    mockFormatRetrievalContext.mockReturnValue('');
    mockGetToolDefinitions.mockReturnValue([]);
    mockGetToolNames.mockReturnValue([]);
    mockAddEntry.mockResolvedValue(undefined);
  });

  it('returns text response for simple message (no tool calls)', async () => {
    mockChatCompletion.mockResolvedValue(makeCompletionResponse({ content: 'Hello back!' }));

    const output = await runSandraAgent(baseInput);

    expect(output.response).toBe('Hello back!');
    expect(output.toolsUsed).toEqual([]);
    expect(output.language).toBe('en');
  });

  it('saves user message to session', async () => {
    mockChatCompletion.mockResolvedValue(makeCompletionResponse());

    await runSandraAgent(baseInput);

    expect(mockAddEntry).toHaveBeenCalledWith('test-session', expect.objectContaining({
      role: 'user',
      content: 'Hello!',
    }));
  });

  it('saves assistant response to session', async () => {
    mockChatCompletion.mockResolvedValue(makeCompletionResponse({ content: 'I am Sandra.' }));

    await runSandraAgent(baseInput);

    expect(mockAddEntry).toHaveBeenCalledWith('test-session', expect.objectContaining({
      role: 'assistant',
      content: 'I am Sandra.',
    }));
  });

  it('executes tool call and loops back to LLM', async () => {
    const toolCallResponse = makeCompletionResponse({
      content: null,
      toolCalls: [{ id: 'call_1', name: 'searchKnowledgeBase', arguments: '{"query":"test"}' }],
      finishReason: 'tool_calls',
    });
    const finalResponse = makeCompletionResponse({ content: 'Based on the search: here is the info.' });

    mockChatCompletion
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(finalResponse);

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase']);
    mockExecuteTool.mockResolvedValue({ success: true, data: { results: ['result1'] } });

    const output = await runSandraAgent(baseInput);

    expect(output.toolsUsed).toContain('searchKnowledgeBase');
    expect(output.response).toBe('Based on the search: here is the info.');
    expect(mockExecuteTool).toHaveBeenCalledWith(
      'searchKnowledgeBase',
      { query: 'test' },
      expect.objectContaining({ sessionId: 'test-session' }),
    );
  });

  it('handles multiple tool calls in one response', async () => {
    const toolCallResponse = makeCompletionResponse({
      content: null,
      toolCalls: [
        { id: 'call_1', name: 'searchKnowledgeBase', arguments: '{"query":"foo"}' },
        { id: 'call_2', name: 'lookupRepo', arguments: '{"repoName":"edlight"}' },
      ],
      finishReason: 'tool_calls',
    });
    const finalResponse = makeCompletionResponse({ content: 'Done.' });

    mockChatCompletion
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(finalResponse);

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
      { name: 'lookupRepo', description: 'Lookup', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase', 'lookupRepo']);
    mockExecuteTool.mockResolvedValue({ success: true, data: {} });

    const output = await runSandraAgent(baseInput);

    expect(output.toolsUsed).toContain('searchKnowledgeBase');
    expect(output.toolsUsed).toContain('lookupRepo');
    expect(mockExecuteTool).toHaveBeenCalledTimes(2);
  });

  it('stops at max iterations and returns fallback message', async () => {
    const alwaysCallsTool = makeCompletionResponse({
      content: null,
      toolCalls: [{ id: 'call_x', name: 'searchKnowledgeBase', arguments: '{}' }],
      finishReason: 'tool_calls',
    });
    mockChatCompletion.mockResolvedValue(alwaysCallsTool);
    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase']);
    mockExecuteTool.mockResolvedValue({ success: true, data: {} });

    const output = await runSandraAgent(baseInput, { maxIterations: 3 });

    expect(output.response).toContain("I'm having trouble completing this request");
    expect(mockChatCompletion).toHaveBeenCalledTimes(3);
  });

  it('handles invalid JSON tool call arguments gracefully', async () => {
    const toolCallResponse = makeCompletionResponse({
      content: null,
      toolCalls: [{ id: 'call_1', name: 'searchKnowledgeBase', arguments: 'not-valid-json' }],
      finishReason: 'tool_calls',
    });
    const finalResponse = makeCompletionResponse({ content: 'Tried my best.' });

    mockChatCompletion
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(finalResponse);

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase']);

    // Should not throw — tool error goes back to LLM
    const output = await runSandraAgent(baseInput);
    expect(output.response).toBe('Tried my best.');
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it('returns provider error message on ProviderError', async () => {
    const { ProviderError } = await import('@/lib/utils');
    mockChatCompletion.mockRejectedValue(new ProviderError('openai', 'API unavailable'));

    const output = await runSandraAgent(baseInput);
    expect(output.response).toContain("I'm temporarily unable to process your request");
  });

  it('returns generic error message on unexpected error', async () => {
    mockChatCompletion.mockRejectedValue(new Error('Unexpected internal error'));

    const output = await runSandraAgent(baseInput);
    expect(output.response).toContain('Something went wrong');
  });

  it('accumulates token usage across iterations', async () => {
    const r1 = makeCompletionResponse({
      content: null,
      toolCalls: [{ id: 'c1', name: 'searchKnowledgeBase', arguments: '{}' }],
      finishReason: 'tool_calls',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
    const r2 = makeCompletionResponse({
      content: 'Done.',
      usage: { promptTokens: 200, completionTokens: 60, totalTokens: 260 },
    });

    mockChatCompletion
      .mockResolvedValueOnce(r1)
      .mockResolvedValueOnce(r2);

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase']);
    mockExecuteTool.mockResolvedValue({ success: true, data: {} });

    const output = await runSandraAgent(baseInput);
    expect(output.tokenUsage?.totalTokens).toBe(410);
  });

  it('marks retrievalUsed=true when retrieval returns results', async () => {
    mockRetrieveContext.mockResolvedValue([{ chunk: { content: 'Some info' }, score: 0.9 }]);
    mockFormatRetrievalContext.mockReturnValue('Some info from KB');
    mockChatCompletion.mockResolvedValue(makeCompletionResponse());

    const output = await runSandraAgent(baseInput);
    expect(output.retrievalUsed).toBe(true);
  });
});

describe('runSandraAgentStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContextMessages.mockResolvedValue([]);
    mockGetMemorySummary.mockResolvedValue('');
    mockRetrieveContext.mockResolvedValue([]);
    mockFormatRetrievalContext.mockReturnValue('');
    mockGetToolDefinitions.mockReturnValue([]);
    mockGetToolNames.mockReturnValue([]);
    mockAddEntry.mockResolvedValue(undefined);
  });

  async function collectEvents(input: AgentInput) {
    const events = [];
    for await (const event of runSandraAgentStream(input)) {
      events.push(event);
    }
    return events;
  }

  it('yields token events and done event for simple response', async () => {
    async function* fakeStream() {
      yield { content: 'Hello ', toolCalls: null, done: false };
      yield { content: 'world!', toolCalls: null, done: false };
      yield { content: null, toolCalls: [], done: true };
    }
    mockStreamChatCompletion.mockReturnValue(fakeStream());

    const events = await collectEvents(baseInput);

    const tokenEvents = events.filter((e) => e.type === 'token');
    const doneEvent = events.find((e) => e.type === 'done');

    expect(tokenEvents).toHaveLength(2);
    expect(tokenEvents[0]?.data).toBe('Hello ');
    expect(tokenEvents[1]?.data).toBe('world!');
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.data).toBe('test-session');
  });

  it('yields tool_call and tool_result events during tool execution', async () => {
    async function* firstStream() {
      yield { content: null, toolCalls: [{ id: 'c1', name: 'searchKnowledgeBase', arguments: '{"query":"test"}' }], done: true };
    }
    async function* secondStream() {
      yield { content: 'Found it!', toolCalls: null, done: false };
      yield { content: null, toolCalls: [], done: true };
    }

    mockStreamChatCompletion
      .mockReturnValueOnce(firstStream())
      .mockReturnValueOnce(secondStream());

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase']);
    mockExecuteTool.mockResolvedValue({ success: true, data: { result: 'data' } });

    const events = await collectEvents(baseInput);

    expect(events.find((e) => e.type === 'tool_call')?.data).toBe('searchKnowledgeBase');
    expect(events.find((e) => e.type === 'tool_result')).toBeDefined();
    expect(events.find((e) => e.type === 'done')).toBeDefined();
  });

  it('yields error event on provider failure', async () => {
    const { ProviderError } = await import('@/lib/utils');
    mockStreamChatCompletion.mockImplementation(() => {
      throw new ProviderError('openai', 'API down');
    });

    const events = await collectEvents(baseInput);

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.data).toContain("I'm temporarily unable to process");
  });
});
