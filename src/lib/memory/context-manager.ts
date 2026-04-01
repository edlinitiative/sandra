/**
 * Context window manager.
 *
 * Estimates token usage for each component of the agent's context
 * (system prompt, retrieval, history, user message) and optimizes
 * the message array to fit within the model's context budget.
 */
import type { ChatMessage } from '@/lib/ai/types';
import { createLogger } from '@/lib/utils';

const log = createLogger('memory:context');

/** Approximate characters per token (English average) */
const CHARS_PER_TOKEN = 4;

/** Maximum token budget for the full context window */
const MAX_CONTEXT_TOKENS = 7000;

/** Reserved tokens for the model's response */
const RESPONSE_RESERVE = 2048;

/** Budget allocations (approximate, flexible) */
const SYSTEM_PROMPT_BUDGET = 1500;
const RETRIEVAL_BUDGET = 1500;
const MIN_HISTORY_BUDGET = 500;
const USER_MESSAGE_BUDGET = 500;

export interface ContextBudget {
  systemPromptTokens: number;
  retrievalTokens: number;
  historyTokens: number;
  userMessageTokens: number;
  totalTokens: number;
  maxTokens: number;
  withinBudget: boolean;
}

/**
 * Estimate the number of tokens in a string.
 * Uses a simple character-based heuristic (4 chars ≈ 1 token for English).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a message array.
 */
export function estimateMessagesTokens(messages: ChatMessage[]): number {
  // Each message has ~4 tokens of overhead (role, formatting)
  const overhead = messages.length * 4;
  const contentTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(Array.isArray(m.content) ? m.content.map(p => p.type === 'text' ? p.text : '[image]').join(' ') : m.content),
    0,
  );
  return overhead + contentTokens;
}

/**
 * Calculate the token budget for each context component.
 */
export function calculateContextBudget(params: {
  systemPrompt: string;
  retrievalContext: string;
  historyMessages: ChatMessage[];
  userMessage: string;
  maxTokens?: number;
}): ContextBudget {
  const maxTokens = params.maxTokens ?? MAX_CONTEXT_TOKENS;
  const systemPromptTokens = estimateTokens(params.systemPrompt);
  const retrievalTokens = estimateTokens(params.retrievalContext);
  const historyTokens = estimateMessagesTokens(params.historyMessages);
  const userMessageTokens = estimateTokens(params.userMessage);
  const totalTokens =
    systemPromptTokens + retrievalTokens + historyTokens + userMessageTokens;

  return {
    systemPromptTokens,
    retrievalTokens,
    historyTokens,
    userMessageTokens,
    totalTokens,
    maxTokens,
    withinBudget: totalTokens <= maxTokens,
  };
}

/**
 * Optimize the context window by trimming history when the budget is exceeded.
 *
 * Strategy:
 * 1. System prompt and user message are always included in full
 * 2. Retrieval context is included in full (already limited by topK)
 * 3. If the history exceeds the remaining budget, inject a conversation
 *    summary and keep only the most recent messages
 *
 * @returns Optimized array of ChatMessage[] ready for the LLM
 */
export function optimizeContextWindow(params: {
  systemPrompt: string;
  retrievalContext: string;
  historyMessages: ChatMessage[];
  userMessage: string;
  conversationSummary?: string;
  maxContextTokens?: number;
}): ChatMessage[] {
  const maxTokens = params.maxContextTokens ?? MAX_CONTEXT_TOKENS;

  // Fixed costs: system prompt + retrieval + user message
  const systemTokens = estimateTokens(params.systemPrompt);
  const retrievalTokens = estimateTokens(params.retrievalContext);
  const userTokens = estimateTokens(params.userMessage);
  const fixedCost = systemTokens + retrievalTokens + userTokens;

  // Available budget for history
  const historyBudget = Math.max(MIN_HISTORY_BUDGET, maxTokens - fixedCost);
  const historyTokens = estimateMessagesTokens(params.historyMessages);

  // If history fits, return everything
  if (historyTokens <= historyBudget) {
    return buildMessages(
      params.systemPrompt,
      params.retrievalContext,
      params.historyMessages,
      params.userMessage,
    );
  }

  // History exceeds budget — trim from the front, keeping recent messages
  log.info('Context budget exceeded, trimming history', {
    historyTokens,
    historyBudget,
    messageCount: params.historyMessages.length,
  });

  const summaryMessage: ChatMessage | null = params.conversationSummary
    ? { role: 'system', content: params.conversationSummary }
    : null;

  const summaryTokens = summaryMessage
    ? estimateTokens(Array.isArray(summaryMessage.content) ? summaryMessage.content.map(p => p.type === 'text' ? p.text : '[image]').join(' ') : summaryMessage.content) + 4
    : 0;
  const remainingBudget = historyBudget - summaryTokens;

  // Keep as many recent messages as fit
  const trimmedHistory = trimMessagesToFit(
    params.historyMessages,
    remainingBudget,
  );

  log.info('History trimmed', {
    originalCount: params.historyMessages.length,
    trimmedCount: trimmedHistory.length,
    hasSummary: !!summaryMessage,
  });

  const historyWithSummary = summaryMessage
    ? [summaryMessage, ...trimmedHistory]
    : trimmedHistory;

  return buildMessages(
    params.systemPrompt,
    params.retrievalContext,
    historyWithSummary,
    params.userMessage,
  );
}

/**
 * Assemble the final message array for the LLM.
 */
function buildMessages(
  systemPrompt: string,
  retrievalContext: string,
  history: ChatMessage[],
  userMessage: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // System prompt (includes retrieval context if non-empty)
  const fullSystemPrompt = retrievalContext
    ? `${systemPrompt}\n\n---\n\n${retrievalContext}`
    : systemPrompt;
  messages.push({ role: 'system', content: fullSystemPrompt });

  // Conversation history
  messages.push(...history);

  // Current user message
  messages.push({ role: 'user', content: userMessage });

  return messages;
}

/**
 * Trim messages from the front to fit within a token budget.
 * Always keeps the most recent messages.
 */
function trimMessagesToFit(
  messages: ChatMessage[],
  maxTokens: number,
): ChatMessage[] {
  let totalTokens = 0;
  const result: ChatMessage[] = [];

  // Walk backwards from most recent
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    const msgTokens = estimateTokens(Array.isArray(msg.content) ? msg.content.map(p => p.type === 'text' ? p.text : '[image]').join(' ') : msg.content) + 4;
    if (totalTokens + msgTokens > maxTokens) {
      break;
    }
    totalTokens += msgTokens;
    result.unshift(msg);
  }

  return result;
}
