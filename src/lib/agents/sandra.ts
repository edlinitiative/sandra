import type { AgentInput, AgentOutput, AgentConfig, AgentState, AgentStreamEvent } from './types';
import { DEFAULT_AGENT_CONFIG } from './types';
import { buildSandraSystemPrompt } from './prompts';
import { generateFollowUps } from './follow-ups';
import { getAIProvider } from '@/lib/ai';
import type { ChatMessage, MessageContentPart } from '@/lib/ai/types';
import { toolRegistry, executeTool } from '@/lib/tools';
import { getSessionStore } from '@/lib/memory/session-store';
import {
  getSessionContinuityContext,
  rememberConversationInsights,
  refreshConversationSummary,
} from '@/lib/memory/session-insights';
import { retrieveContext, formatRetrievalContext, inferKnowledgeQueryContext } from '@/lib/knowledge';
import { createLogger, ProviderError } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

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

  log.info(`Agent invoked`, {
    sessionId: input.sessionId,
    language: input.language,
    channel: input.channel,
    messageLength: input.message.length,
  });

  const agentStartMs = Date.now();

  trackEvent({
    eventType: 'session_started',
    sessionId: input.sessionId,
    userId: input.userId,
    channel: input.channel,
    language: input.language,
    data: { channel: input.channel ?? 'web', language: input.language, isNewSession: false },
  });

  trackEvent({
    eventType: 'message_sent',
    sessionId: input.sessionId,
    userId: input.userId,
    channel: input.channel,
    language: input.language,
    data: { messageLength: input.message.length, channel: input.channel ?? 'web', language: input.language },
  });

  try {
    // 1. Load conversation history (DB is single source of truth)
    const historyMessages = await sessionStore.getContextMessages(input.sessionId);

    // 2. Load user memory
    let userMemorySummary = '';
    let conversationSummary = '';
    try {
      const continuity = await getSessionContinuityContext({
        sessionId: input.sessionId,
        userId: input.userId,
      });
      userMemorySummary = continuity.memorySummary;
      conversationSummary = continuity.conversationSummary;
    } catch (error) {
      log.warn('Failed to load continuity context', {
        sessionId: input.sessionId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }

    // 3. Retrieval: search knowledge base for context
    let retrievalContextStr = '';
    if (cfg.enableRetrieval) {
      try {
        const inferredContext = inferKnowledgeQueryContext(input.message);
        const results = await retrieveContext(input.message, {
          topK: 4,
          minScore: inferredContext.minScore,
          filter: {
            platform: inferredContext.platform,
            contentType: inferredContext.contentType,
            preferPaths: inferredContext.preferPaths,
          },
        });
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
      channel: input.channel,
      senderName: input.senderName,
      userMemorySummary,
      conversationSummary: conversationSummary || undefined,
      retrievalContext: retrievalContextStr,
      availableTools: toolNames,
    });

    // 5. Assemble messages — build multimodal content when image attachments are present
    const imageAttachments = input.attachments?.filter(a => a.type === 'image') ?? [];
    const userContent: ChatMessage['content'] = imageAttachments.length > 0
      ? [
          { type: 'text', text: input.message || 'What do you see in this image?' } as MessageContentPart,
          ...imageAttachments.map(a => ({
            type: 'image_url' as const,
            image_url: { url: a.url, detail: 'auto' as const },
          } as MessageContentPart)),
        ]
      : input.message;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userContent },
    ];

    // Save user message to session (DB-backed)
    await sessionStore.addEntry(input.sessionId, {
      role: 'user',
      content: input.message,
      timestamp: new Date(),
    });

    await rememberConversationInsights({
      sessionId: input.sessionId,
      userId: input.userId,
      language: input.language,
      message: input.message,
    }).catch(() => { /* best-effort */ });

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

      log.info('Calling LLM', { sessionId: input.sessionId, iteration: state.iterations });

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

        // Save assistant response to session (DB-backed)
        await sessionStore.addEntry(input.sessionId, {
          role: 'assistant',
          content,
          timestamp: new Date(),
        });

        await refreshConversationSummary(input.sessionId).catch(() => { /* best-effort */ });

        log.info(`Agent turn complete`, {
          sessionId: input.sessionId,
          iterations: state.iterations,
          toolsUsed,
          totalTokens: totalUsage.totalTokens,
        });

        trackEvent({
          eventType: 'response_generated',
          sessionId: input.sessionId,
          userId: input.userId,
          channel: input.channel,
          language: input.language,
          data: { latencyMs: Date.now() - agentStartMs, responseLength: content.length, toolsUsed, model: 'gpt-4o', cacheHit: false },
        });

        return {
          response: content,
          language: input.language,
          toolsUsed,
          retrievalUsed: retrievalContextStr.length > 0,
          suggestedFollowUps: generateFollowUps(toolsUsed, input.language),
          tokenUsage: totalUsage,
        };
      }

      // Add assistant message with tool calls to context
      state.messages.push({
          role: 'assistant',
          content: response.content ?? '',
          toolCalls: response.toolCalls,
        });

      // Execute tool calls sequentially
      for (const toolCall of response.toolCalls) {
        log.info(`Executing tool: ${toolCall.name}`, { id: toolCall.id, sessionId: input.sessionId });
        toolsUsed.push(toolCall.name);

        const toolStartMs = Date.now();
        let resultStr: string;
        let toolSuccess = true;
        let toolError: string | undefined;
        try {
          const parsedArgs = JSON.parse(toolCall.arguments) as unknown;
          const result = await executeTool(toolCall.name, parsedArgs, {
            sessionId: input.sessionId,
            userId: input.userId,
            scopes: input.scopes ?? ['knowledge:read', 'repos:read'],
          });
          resultStr = result.success
            ? JSON.stringify(result.data ?? {})
            : `Tool call failed: ${result.error ?? 'unknown error'}`;
          if (!result.success) { toolSuccess = false; toolError = result.error ?? undefined; }
        } catch (err) {
          toolSuccess = false;
          if (err instanceof SyntaxError) {
            resultStr = 'Tool call failed: invalid arguments (could not parse JSON)';
            toolError = 'invalid arguments';
            log.warn(`Invalid tool call arguments for ${toolCall.name}`, { id: toolCall.id });
          } else {
            resultStr = `Tool call failed: ${err instanceof Error ? err.message : 'unknown error'}`;
            toolError = err instanceof Error ? err.message : 'unknown error';
            log.error(`Tool execution error for ${toolCall.name}`, { id: toolCall.id, err });
          }
        }

        trackEvent({
          eventType: 'tool_executed',
          sessionId: input.sessionId,
          userId: input.userId,
          channel: input.channel,
          language: input.language,
          data: { toolName: toolCall.name, latencyMs: Date.now() - toolStartMs, success: toolSuccess, errorMessage: toolError },
        });

        // Feed tool result back to LLM
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

    const fallback = "I'm having trouble completing this request. Let me try to help differently.";

    await sessionStore.addEntry(input.sessionId, {
      role: 'assistant',
      content: fallback,
      timestamp: new Date(),
    });

    await refreshConversationSummary(input.sessionId).catch(() => { /* best-effort */ });

    return {
      response: fallback,
      language: input.language,
      toolsUsed,
      retrievalUsed: retrievalContextStr.length > 0,
      suggestedFollowUps: generateFollowUps(toolsUsed, input.language),
      tokenUsage: totalUsage,
    };
  } catch (err) {
    log.error('Agent loop failed', {
      sessionId: input.sessionId,
      error: err instanceof Error ? err.message : 'unknown',
    });

    let errorMessage: string;
    if (err instanceof ProviderError) {
      errorMessage = "I'm temporarily unable to process your request. Please try again.";
    } else {
      errorMessage = 'Something went wrong. Please try again later.';
    }

    // Save error message to session for conversation continuity
    try {
      const sessionStore = getSessionStore();
      await sessionStore.addEntry(input.sessionId, {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
      });
    } catch {
      // Best effort
    }

    return {
      response: errorMessage,
      language: input.language,
      toolsUsed: [],
      retrievalUsed: false,
    };
  }
}

/**
 * Streaming variant of the Sandra agent.
 * Yields AgentStreamEvents as tokens arrive from the LLM.
 */
export async function* runSandraAgentStream(
  input: AgentInput,
  config?: Partial<AgentConfig>,
): AsyncIterable<AgentStreamEvent> {
  const cfg = { ...DEFAULT_AGENT_CONFIG, ...config };
  const provider = getAIProvider();
  const sessionStore = getSessionStore();

  log.info('Streaming agent invoked', { sessionId: input.sessionId });

  try {
    // Load conversation history (DB is single source of truth)
    const historyMessages = await sessionStore.getContextMessages(input.sessionId);

    // Load user memory
    let userMemorySummary = '';
    let conversationSummary = '';
    try {
      const continuity = await getSessionContinuityContext({
        sessionId: input.sessionId,
        userId: input.userId,
      });
      userMemorySummary = continuity.memorySummary;
      conversationSummary = continuity.conversationSummary;
    } catch {
      // Continue without continuity context
    }

    // Retrieval
    let retrievalContextStr = '';
    if (cfg.enableRetrieval) {
      try {
        const inferredContext = inferKnowledgeQueryContext(input.message);
        const results = await retrieveContext(input.message, {
          topK: 4,
          minScore: inferredContext.minScore,
          filter: {
            platform: inferredContext.platform,
            contentType: inferredContext.contentType,
            preferPaths: inferredContext.preferPaths,
          },
        });
        if (results.length > 0) {
          retrievalContextStr = formatRetrievalContext(results);
        }
      } catch {
        // Continue without retrieval
      }
    }

    // Build system prompt
    const toolDefinitions = cfg.enableTools ? toolRegistry.getToolDefinitions() : [];
    const toolNames = cfg.enableTools ? toolRegistry.getToolNames() : [];

    const systemPrompt = buildSandraSystemPrompt({
      language: input.language,
      channel: input.channel,
      senderName: input.senderName,
      userMemorySummary,
      conversationSummary: conversationSummary || undefined,
      retrievalContext: retrievalContextStr,
      availableTools: toolNames,
    });

    // Assemble messages — build multimodal content when image attachments are present
    const imageAttachments = input.attachments?.filter(a => a.type === 'image') ?? [];
    const userContent: ChatMessage['content'] = imageAttachments.length > 0
      ? [
          { type: 'text', text: input.message || 'What do you see in this image?' } as MessageContentPart,
          ...imageAttachments.map(a => ({
            type: 'image_url' as const,
            image_url: { url: a.url, detail: 'auto' as const },
          } as MessageContentPart)),
        ]
      : input.message;

    // Assemble messages
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userContent },
    ];

    // Save user message (DB-backed)
    await sessionStore.addEntry(input.sessionId, {
      role: 'user',
      content: input.message,
      timestamp: new Date(),
    });

    await rememberConversationInsights({
      sessionId: input.sessionId,
      userId: input.userId,
      language: input.language,
      message: input.message,
    }).catch(() => { /* best-effort */ });

    let iterations = 0;
    const toolsUsed: string[] = [];

    while (iterations < cfg.maxIterations) {
      iterations++;

      // Collect streamed tokens; detect tool calls at end
      let fullContent = '';
      let toolCallsFromStream: import('@/lib/ai/types').ToolCall[] | null = null;

      // Stream the LLM response
      for await (const chunk of provider.streamChatCompletion({
        messages,
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
        toolChoice: toolDefinitions.length > 0 ? 'auto' : undefined,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
      })) {
        if (chunk.content) {
          fullContent += chunk.content;
          yield { type: 'token', data: chunk.content };
        }
        if (chunk.done && chunk.toolCalls) {
          toolCallsFromStream = chunk.toolCalls;
        }
      }

      // If no tool calls, streaming is done
      if (!toolCallsFromStream || toolCallsFromStream.length === 0) {
        const response =
          fullContent || 'I apologize, but I was unable to generate a response. Please try again.';

        await sessionStore.addEntry(input.sessionId, {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        });

        await refreshConversationSummary(input.sessionId).catch(() => { /* best-effort */ });

        yield {
          type: 'done',
          data: {
            sessionId: input.sessionId,
            response,
            toolsUsed,
            retrievalUsed: retrievalContextStr.length > 0,
            suggestedFollowUps: generateFollowUps(toolsUsed, input.language),
          },
        };
        return;
      }

      // Tool calls detected — execute them
      messages.push({
        role: 'assistant',
        content: fullContent,
        toolCalls: toolCallsFromStream,
      });

      log.info('Streaming assistant tool calls captured', {
        sessionId: input.sessionId,
        toolCallsFromStream,
        fullContent,
      });

      log.info('Messages before tool execution', {
        sessionId: input.sessionId,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          toolCallId: 'toolCallId' in m ? m.toolCallId : undefined,
          toolCalls: 'toolCalls' in m ? m.toolCalls : undefined,
          name: 'name' in m ? m.name : undefined,
        })),
      });

      for (const toolCall of toolCallsFromStream) {
        toolsUsed.push(toolCall.name);
        yield { type: 'tool_call', data: toolCall.name };

        let resultStr: string;
        try {
          const parsedArgs = JSON.parse(toolCall.arguments) as unknown;
          const result = await executeTool(toolCall.name, parsedArgs, {
            sessionId: input.sessionId,
            userId: input.userId,
            scopes: input.scopes ?? ['knowledge:read', 'repos:read'],
          });
          resultStr = result.success
            ? JSON.stringify(result.data ?? {})
            : `Tool call failed: ${result.error ?? 'unknown error'}`;
        } catch (err) {
          resultStr = err instanceof SyntaxError
            ? 'Tool call failed: invalid arguments'
            : `Tool call failed: ${err instanceof Error ? err.message : 'unknown error'}`;
        }

        yield { type: 'tool_result', data: resultStr };

        log.info('Pushing tool result message', {
          sessionId: input.sessionId,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });

        messages.push({
          role: 'tool',
          content: resultStr,
          toolCallId: toolCall.id,
          name: toolCall.name,
        });
      }
    }

    // Max iterations reached
    const fallback = "I'm having trouble completing this request. Let me try to help differently.";
    await sessionStore.addEntry(input.sessionId, {
      role: 'assistant',
      content: fallback,
      timestamp: new Date(),
    });

    await refreshConversationSummary(input.sessionId).catch(() => { /* best-effort */ });

    yield { type: 'token', data: fallback };
    yield {
      type: 'done',
      data: {
        sessionId: input.sessionId,
        response: fallback,
        toolsUsed,
        retrievalUsed: retrievalContextStr.length > 0,
        suggestedFollowUps: generateFollowUps(toolsUsed, input.language),
      },
    };
  } catch (err) {
    log.error('Streaming agent failed', {
      sessionId: input.sessionId,
      error: err instanceof Error ? err.message : 'unknown',
    });

    const errorMessage = err instanceof ProviderError
      ? "I'm temporarily unable to process your request. Please try again."
      : 'Something went wrong. Please try again later.';

    yield { type: 'error', data: errorMessage };
  }
}
