import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatCompletionResponse } from '@/lib/ai/types';

// ── Mock setup ───────────────────────────────────────────────────────────────

const {
  mockChatCompletion,
  mockStreamChatCompletion,
  mockGetContextMessages,
  mockAddEntry,
  mockGetMemorySummary,
  mockGetSessionContinuityContext,
  mockRememberConversationInsights,
  mockRefreshConversationSummary,
  mockRetrieveContext,
  mockFormatRetrievalContext,
  mockInferKnowledgeQueryContext,
  mockGetToolDefinitions,
  mockGetToolNames,
  mockExecuteTool,
} = vi.hoisted(() => ({
  mockChatCompletion: vi.fn(),
  mockStreamChatCompletion: vi.fn(),
  mockGetContextMessages: vi.fn(),
  mockAddEntry: vi.fn(),
  mockGetMemorySummary: vi.fn(),
  mockGetSessionContinuityContext: vi.fn(),
  mockRememberConversationInsights: vi.fn(),
  mockRefreshConversationSummary: vi.fn(),
  mockRetrieveContext: vi.fn(),
  mockFormatRetrievalContext: vi.fn(),
  mockInferKnowledgeQueryContext: vi.fn(),
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
    getHistory: mockGetContextMessages,
  }),
}));

vi.mock('@/lib/memory/user-memory', () => ({
  getUserMemoryStore: () => ({ getMemorySummary: mockGetMemorySummary }),
}));

vi.mock('@/lib/memory/session-insights', () => ({
  getSessionContinuityContext: mockGetSessionContinuityContext,
  rememberConversationInsights: mockRememberConversationInsights,
  refreshConversationSummary: mockRefreshConversationSummary,
}));

vi.mock('@/lib/knowledge', () => ({
  retrieveContext: mockRetrieveContext,
  formatRetrievalContext: mockFormatRetrievalContext,
  inferKnowledgeQueryContext: mockInferKnowledgeQueryContext,
}));

vi.mock('@/lib/tools', () => ({
  toolRegistry: {
    getToolDefinitions: mockGetToolDefinitions,
    getToolNames: mockGetToolNames,
  },
  executeTool: mockExecuteTool,
}));

import { runSandraAgent, runSandraAgentStream } from '../sandra';
import type { AgentConfig, AgentInput } from '../types';

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
    mockGetSessionContinuityContext.mockResolvedValue({
      memorySummary: '',
      conversationSummary: '',
    });
    mockRememberConversationInsights.mockResolvedValue(undefined);
    mockRefreshConversationSummary.mockResolvedValue(undefined);
    mockRetrieveContext.mockResolvedValue([]);
    mockFormatRetrievalContext.mockReturnValue('');
    mockInferKnowledgeQueryContext.mockReturnValue({ minScore: 0.2 });
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

  it('includes continuity context in the system prompt when available', async () => {
    mockGetSessionContinuityContext.mockResolvedValue({
      memorySummary: 'Known facts from this session:\n- Learning goals: learn Python',
      conversationSummary: 'Earlier conversation summary:\n- Earlier user questions/goals: Start coding',
    });
    mockChatCompletion.mockResolvedValue(makeCompletionResponse({ content: 'Hello back!' }));

    await runSandraAgent(baseInput);

    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('Known facts from this session'),
          }),
        ]),
      }),
    );
    const systemMessage = mockChatCompletion.mock.calls[0]![0].messages[0];
    expect(systemMessage.content).toContain('Earlier conversation summary');
  });

  it('saves user message to session', async () => {
    mockChatCompletion.mockResolvedValue(makeCompletionResponse());

    await runSandraAgent(baseInput);

    expect(mockAddEntry).toHaveBeenCalledWith('test-session', expect.objectContaining({
      role: 'user',
      content: 'Hello!',
    }));
    expect(mockRememberConversationInsights).toHaveBeenCalledWith({
      sessionId: 'test-session',
      userId: undefined,
      language: 'en',
      message: 'Hello!',
    });
  });

  it('saves assistant response to session', async () => {
    mockChatCompletion.mockResolvedValue(makeCompletionResponse({ content: 'I am Sandra.' }));

    await runSandraAgent(baseInput);

    expect(mockAddEntry).toHaveBeenCalledWith('test-session', expect.objectContaining({
      role: 'assistant',
      content: 'I am Sandra.',
    }));
    expect(mockRefreshConversationSummary).toHaveBeenCalledWith('test-session');
  });

  it('loads persisted context from session store (DB-backed)', async () => {
    mockGetContextMessages.mockResolvedValue([
      { role: 'user', content: 'Earlier question' },
      { role: 'assistant', content: 'Earlier answer' },
    ]);
    mockChatCompletion.mockResolvedValue(makeCompletionResponse({ content: 'Follow-up answer' }));

    await runSandraAgent({
      ...baseInput,
      message: 'And what next?',
    });

    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Earlier question' }),
          expect.objectContaining({ role: 'assistant', content: 'Earlier answer' }),
        ]),
      }),
    );
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
    mockInferKnowledgeQueryContext.mockReturnValue({ minScore: 0.2 });
    mockGetToolDefinitions.mockReturnValue([]);
    mockGetToolNames.mockReturnValue([]);
    mockAddEntry.mockResolvedValue(undefined);
  });

  async function collectEvents(input: AgentInput, config?: Partial<AgentConfig>) {
    const events = [];
    for await (const event of runSandraAgentStream(input, config)) {
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
    expect(doneEvent?.data).toMatchObject({
      sessionId: 'test-session',
      response: 'Hello world!',
      toolsUsed: [],
      retrievalUsed: false,
    });
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

  // ── Tool continuity regression tests (V2 Phase 2) ────────────────────────────

  it('[regression] assistant message with toolCalls precedes tool results in second LLM call', async () => {
    async function* firstStream() {
      yield { content: null, toolCalls: [{ id: 'c1', name: 'searchKnowledgeBase', arguments: '{"query":"x"}' }], done: true };
    }
    async function* secondStream() {
      yield { content: 'Answer here.', toolCalls: null, done: false };
      yield { content: null, toolCalls: null, done: true };
    }

    mockStreamChatCompletion
      .mockReturnValueOnce(firstStream())
      .mockReturnValueOnce(secondStream());

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase']);
    mockExecuteTool.mockResolvedValue({ success: true, data: { result: 'data' } });

    await collectEvents(baseInput);

    // The second streamChatCompletion call must receive messages with:
    //   assistant (toolCalls) → then → tool (result)
    expect(mockStreamChatCompletion).toHaveBeenCalledTimes(2);
    const secondCallMessages = mockStreamChatCompletion.mock.calls[1]![0].messages as Array<{
      role: string;
      toolCalls?: unknown[];
    }>;

    const assistantIndex = secondCallMessages.findIndex(
      (m) => m.role === 'assistant' && Array.isArray(m.toolCalls) && m.toolCalls.length > 0,
    );
    const toolIndex = secondCallMessages.findIndex((m) => m.role === 'tool');

    expect(assistantIndex).toBeGreaterThanOrEqual(0);
    expect(toolIndex).toBeGreaterThan(assistantIndex);
  });

  it('[regression] token events from follow-up stream are yielded after tool execution', async () => {
    async function* firstStream() {
      yield { content: null, toolCalls: [{ id: 'c1', name: 'searchKnowledgeBase', arguments: '{}' }], done: true };
    }
    async function* secondStream() {
      yield { content: 'Here is ', toolCalls: null, done: false };
      yield { content: 'your answer.', toolCalls: null, done: false };
      yield { content: null, toolCalls: null, done: true };
    }

    mockStreamChatCompletion
      .mockReturnValueOnce(firstStream())
      .mockReturnValueOnce(secondStream());

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase']);
    mockExecuteTool.mockResolvedValue({ success: true, data: {} });

    const events = await collectEvents(baseInput);
    const tokenData = events.filter((e) => e.type === 'token').map((e) => e.data);

    expect(tokenData).toContain('Here is ');
    expect(tokenData).toContain('your answer.');
  });

  it('[regression] session is persisted with final assistant response after tool execution', async () => {
    async function* firstStream() {
      yield { content: null, toolCalls: [{ id: 'c1', name: 'searchKnowledgeBase', arguments: '{}' }], done: true };
    }
    async function* secondStream() {
      yield { content: 'Final answer.', toolCalls: null, done: false };
      yield { content: null, toolCalls: null, done: true };
    }

    mockStreamChatCompletion
      .mockReturnValueOnce(firstStream())
      .mockReturnValueOnce(secondStream());

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase']);
    mockExecuteTool.mockResolvedValue({ success: true, data: {} });

    await collectEvents(baseInput);

    expect(mockAddEntry).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({ role: 'assistant', content: 'Final answer.' }),
    );
  });

  it('[regression] multiple tool calls yield multiple tool_call and tool_result events', async () => {
    async function* firstStream() {
      yield {
        content: null,
        toolCalls: [
          { id: 'c1', name: 'searchKnowledgeBase', arguments: '{"query":"foo"}' },
          { id: 'c2', name: 'lookupRepoInfo', arguments: '{"repoName":"edlight"}' },
        ],
        done: true,
      };
    }
    async function* secondStream() {
      yield { content: 'Done.', toolCalls: null, done: false };
      yield { content: null, toolCalls: null, done: true };
    }

    mockStreamChatCompletion
      .mockReturnValueOnce(firstStream())
      .mockReturnValueOnce(secondStream());

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
      { name: 'lookupRepoInfo', description: 'Lookup', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase', 'lookupRepoInfo']);
    mockExecuteTool.mockResolvedValue({ success: true, data: {} });

    const events = await collectEvents(baseInput);

    const toolCallEvents = events.filter((e) => e.type === 'tool_call');
    const toolResultEvents = events.filter((e) => e.type === 'tool_result');

    expect(toolCallEvents).toHaveLength(2);
    expect(toolCallEvents[0]?.data).toBe('searchKnowledgeBase');
    expect(toolCallEvents[1]?.data).toBe('lookupRepoInfo');
    expect(toolResultEvents).toHaveLength(2);
    expect(mockExecuteTool).toHaveBeenCalledTimes(2);
  });

  it('[regression] tool execution failure feeds error to LLM and stream completes', async () => {
    async function* firstStream() {
      yield { content: null, toolCalls: [{ id: 'c1', name: 'searchKnowledgeBase', arguments: '{}' }], done: true };
    }
    async function* secondStream() {
      yield { content: 'I could not find that.', toolCalls: null, done: false };
      yield { content: null, toolCalls: null, done: true };
    }

    mockStreamChatCompletion
      .mockReturnValueOnce(firstStream())
      .mockReturnValueOnce(secondStream());

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase']);
    mockExecuteTool.mockResolvedValue({ success: false, error: 'KB unavailable' });

    const events = await collectEvents(baseInput);

    // Tool result should contain the error
    const toolResultEvent = events.find((e) => e.type === 'tool_result');
    expect(toolResultEvent?.data).toContain('Tool call failed');

    // Stream should still complete with done
    expect(events.find((e) => e.type === 'done')).toBeDefined();

    // LLM was called twice (once for tool call, once with error result)
    expect(mockStreamChatCompletion).toHaveBeenCalledTimes(2);
  });

  it('[regression] streaming agent reaches max iterations and yields fallback', async () => {
    async function* alwaysTools() {
      yield { content: null, toolCalls: [{ id: 'cx', name: 'searchKnowledgeBase', arguments: '{}' }], done: true };
    }

    // Every stream call triggers another tool call → loops until maxIterations
    mockStreamChatCompletion.mockImplementation(() => alwaysTools());

    mockGetToolDefinitions.mockReturnValue([
      { name: 'searchKnowledgeBase', description: 'Search', parameters: {} },
    ]);
    mockGetToolNames.mockReturnValue(['searchKnowledgeBase']);
    mockExecuteTool.mockResolvedValue({ success: true, data: {} });

    const events = await collectEvents({ ...baseInput }, { maxIterations: 3 });

    // Should yield the fallback token and a done event
    const tokenEvents = events.filter((e) => e.type === 'token');
    const doneEvent = events.find((e) => e.type === 'done');

    expect(tokenEvents.some((e) => e.data.includes("I'm having trouble"))).toBe(true);
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.data).toMatchObject({
      sessionId: 'test-session',
      response: "I'm having trouble completing this request. Let me try to help differently.",
    });
    expect(mockStreamChatCompletion).toHaveBeenCalledTimes(3);
  });
});
