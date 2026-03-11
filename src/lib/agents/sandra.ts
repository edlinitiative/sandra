import type { AgentInput, AgentOutput, AgentConfig, AgentState } from './types';
import { DEFAULT_AGENT_CONFIG } from './types';
import { buildSandraSystemPrompt } from './prompts';
import { getAIProvider } from '@/lib/ai';
import type { ChatMessage } from '@/lib/ai/types';
import { toolRegistry, executeTool } from '@/lib/tools';
import { getSessionStore } from '@/lib/memory/session-store';
import { getUserMemoryStore } from '@/lib/memory/user-memory';
import { retrieveContext, formatRetrievalContext } from '@/lib/knowledge';
import { createLogger } from '@/lib/utils';

const log = createLogger('agents:sandra');

/**
 * Run the Sandra agent loop.
 *
 * Flow:
 * 1. Load session memory (conversation history)
 * 2. Load user memory (long-term facts)
 * 3. Optionally retrieve relevant knowledge
 * 4. Build system prompt
 * 5. Call the LLM (with tools if enabled)
 * 6. If tool calls are returned, execute them and loop
 * 7. Return the final response
 */
export async function runSandraAgent(
  input: AgentInput,
  config?: Partial<AgentConfig>,
): Promise<AgentOutput> {
  const cfg = { ...DEFAULT_AGENT_CONFIG, ...config };
  const provider = getAIProvider();
  const sessionStore = getSessionStore();
  const userMemoryStore = getUserMemoryStore();

  log.info(`Agent invoked`, {
    sessionId: input.sessionId,
    language: input.language,
    channel: input.channel,
    messageLength: input.message.length,
  });

  // 1. Load conversation history
  const historyMessages = await sessionStore.getContextMessages(input.sessionId);

  // 2. Load user memory
  let userMemorySummary = '';
  if (input.userId) {
    userMemorySummary = await userMemoryStore.getMemorySummary(input.userId);
  }

  // 3. Retrieval: search knowledge base for context
  let retrievalContextStr = '';
  if (cfg.enableRetrieval) {
    try {
      const results = await retrieveContext(input.message, { topK: 3, minScore: 0.5 });
      if (results.length > 0) {
        retrievalContextStr = formatRetrievalContext(results);
      }
    } catch (error) {
      log.warn('Retrieval failed, continuing without context', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  // 4. Build system prompt
  const toolDefinitions = cfg.enableTools ? toolRegistry.getToolDefinitions() : [];
  const toolNames = cfg.enableTools ? toolRegistry.getToolNames() : [];

  const systemPrompt = buildSandraSystemPrompt({
    language: input.language,
    userMemorySummary,
    retrievalContext: retrievalContextStr,
    availableTools: toolNames,
  });

  // 5. Assemble messages
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: input.message },
  ];

  // Save user message to session
  await sessionStore.addEntry(input.sessionId, {
    role: 'user',
    content: input.message,
    timestamp: new Date(),
  });

  // 6. Agent loop (handles tool calls)
  const state: AgentState = {
    messages,
    toolCalls: [],
    toolResults: new Map(),
    retrievalContext: retrievalContextStr,
    iterations: 0,
    maxIterations: cfg.maxIterations,
  };

  const toolsUsed: string[] = [];
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  while (state.iterations < state.maxIterations) {
    state.iterations++;

    const response = await provider.chatCompletion({
      messages: state.messages,
      tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
      toolChoice: toolDefinitions.length > 0 ? 'auto' : undefined,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
    });

    // Accumulate token usage
    totalUsage.promptTokens += response.usage.promptTokens;
    totalUsage.completionTokens += response.usage.completionTokens;
    totalUsage.totalTokens += response.usage.totalTokens;

    // If no tool calls, we have the final response
    if (response.toolCalls.length === 0 || response.finishReason !== 'tool_calls') {
      const content = response.content ?? 'I apologize, but I was unable to generate a response. Please try again.';

      // Save assistant response to session
      await sessionStore.addEntry(input.sessionId, {
        role: 'assistant',
        content,
        timestamp: new Date(),
      });

      log.info(`Agent response generated`, {
        sessionId: input.sessionId,
        iterations: state.iterations,
        toolsUsed,
        totalTokens: totalUsage.totalTokens,
      });

      return {
        response: content,
        language: input.language,
        toolsUsed,
        retrievalUsed: retrievalContextStr.length > 0,
        tokenUsage: totalUsage,
      };
    }

    // Execute tool calls
    // Add assistant message with tool calls to context
    state.messages.push({
      role: 'assistant',
      content: response.content ?? '',
    });

    for (const toolCall of response.toolCalls) {
      log.info(`Executing tool: ${toolCall.name}`, { id: toolCall.id });
      toolsUsed.push(toolCall.name);

      const result = await executeTool(toolCall.name, toolCall.arguments);
      const resultStr = JSON.stringify(result.data ?? result.error ?? 'No result');

      // Add tool result to messages
      state.messages.push({
        role: 'tool',
        content: resultStr,
        toolCallId: toolCall.id,
        name: toolCall.name,
      });

      state.toolResults.set(toolCall.id, resultStr);
    }
  }

  // Max iterations reached
  log.warn(`Agent hit max iterations`, { sessionId: input.sessionId, iterations: state.iterations });

  const fallback = 'I apologize, but I need more time to process your request. Could you try rephrasing your question?';

  await sessionStore.addEntry(input.sessionId, {
    role: 'assistant',
    content: fallback,
    timestamp: new Date(),
  });

  return {
    response: fallback,
    language: input.language,
    toolsUsed,
    retrievalUsed: retrievalContextStr.length > 0,
    tokenUsage: totalUsage,
  };
}
