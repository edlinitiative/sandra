/**
 * AI-powered conversation summarizer.
 *
 * Uses the LLM to create a concise summary of older conversation messages
 * when the context window budget is exceeded. Falls back to the rule-based
 * summary from session-insights.ts if the AI call fails.
 */
import type { ChatMessage } from '@/lib/ai/types';
import { getAIProvider } from '@/lib/ai';
import { buildConversationSummary } from './session-insights';
import { createLogger } from '@/lib/utils';

const log = createLogger('memory:summarizer');

/** Minimum messages before AI summarization kicks in */
const AI_SUMMARY_THRESHOLD = 30;

/** Maximum messages to feed into the summarizer prompt */
const MAX_MESSAGES_FOR_SUMMARY = 40;

const SUMMARIZER_SYSTEM_PROMPT = `You are a conversation summarizer for Sandra, an AI assistant for the EdLight education platform.

Summarize the earlier part of this conversation into a concise paragraph (3-5 sentences max).
Focus on:
- What the user asked about
- Key information Sandra provided
- Any user preferences or context revealed (name, role, interests)
- Decisions made or actions taken

Be factual and brief. Do NOT add opinions or new information.
Write the summary in the same language the conversation was conducted in.`;

/**
 * Generate an AI-powered summary of older conversation messages.
 *
 * @param messages - The full message history (will take older portion)
 * @param recentCount - Number of recent messages to exclude from summarization
 * @returns A concise summary string, or empty string if not needed
 */
export async function summarizeConversation(
  messages: Array<Pick<ChatMessage, 'role' | 'content'>>,
  recentCount: number = 8,
): Promise<string> {
  // Filter to user-facing messages only
  const userFacing = messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  );

  // Don't summarize if conversation is short
  if (userFacing.length <= AI_SUMMARY_THRESHOLD) {
    // Fall back to rule-based summary
    return buildConversationSummary(userFacing.map(m => ({ ...m, content: Array.isArray(m.content) ? m.content.map(p => p.type === 'text' ? p.text : '[image]').join(' ') : m.content })));
  }

  // Take older messages (excluding recent ones)
  const olderMessages = userFacing.slice(
    0,
    Math.max(0, userFacing.length - recentCount),
  );

  if (olderMessages.length === 0) {
    return '';
  }

  // Cap the number of messages we send to the summarizer
  const toSummarize = olderMessages.slice(-MAX_MESSAGES_FOR_SUMMARY);

  try {
    const provider = getAIProvider();
    const conversationText = toSummarize
      .map((m) => {
        const text = Array.isArray(m.content) ? m.content.map(p => p.type === 'text' ? p.text : '[image]').join(' ') : m.content;
        return `${m.role === 'user' ? 'User' : 'Sandra'}: ${text}`;
      })
      .join('\n');

    const result = await provider.chatCompletion({
      messages: [
        { role: 'system', content: SUMMARIZER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Summarize this earlier conversation:\n\n${conversationText}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 300,
    });

    const summary = result.content?.trim();
    if (summary) {
      log.info('AI conversation summary generated', {
        inputMessages: toSummarize.length,
        summaryLength: summary.length,
      });
      return `Earlier conversation summary:\n${summary}`;
    }
  } catch (error) {
    log.warn('AI summarization failed, falling back to rule-based', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }

  // Fallback to rule-based summary
  return buildConversationSummary(userFacing.map(m => ({ ...m, content: Array.isArray(m.content) ? m.content.map(p => p.type === 'text' ? p.text : '[image]').join(' ') : m.content })));
}

/**
 * Determine if a conversation needs AI summarization based on message count.
 */
export function needsAISummarization(messageCount: number): boolean {
  return messageCount > AI_SUMMARY_THRESHOLD;
}
