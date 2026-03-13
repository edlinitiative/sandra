import type { AgentContext } from './types';
import type { Language } from '@/lib/i18n/types';
import { buildSandraSystemPrompt } from './prompts';
import { getSessionStore } from '@/lib/memory/session-store';
import { getUserMemoryStore } from '@/lib/memory/user-memory';
import { toolRegistry } from '@/lib/tools';
import { MAX_CONTEXT_MESSAGES } from '@/lib/config';
import { createLogger } from '@/lib/utils';

const log = createLogger('agents:context');

/**
 * Assemble the full context needed for an agent turn.
 * Loads session history, user memory, and tool definitions,
 * then builds the system prompt.
 */
export async function assembleContext(params: {
  sessionId: string;
  language: Language;
  userId?: string;
}): Promise<AgentContext> {
  const { sessionId, language, userId } = params;
  const sessionStore = getSessionStore();
  const userMemoryStore = getUserMemoryStore();

  log.debug('Assembling context', { sessionId, language });

  // Load conversation history
  const messageHistory = await sessionStore.getContextMessages(sessionId, MAX_CONTEXT_MESSAGES);

  // Load user memory summary (if userId provided)
  let userMemorySummary = '';
  if (userId) {
    try {
      userMemorySummary = await userMemoryStore.getMemorySummary(userId);
    } catch (err) {
      log.warn('Failed to load user memory', {
        userId,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // Get tool definitions
  const tools = toolRegistry.getToolDefinitions();

  // Build system prompt
  const systemPrompt = buildSandraSystemPrompt({
    language,
    userMemorySummary: userMemorySummary || undefined,
    availableTools: tools.map((t) => t.name),
  });

  log.debug('Context assembled', {
    sessionId,
    historyLength: messageHistory.length,
    toolCount: tools.length,
    hasMemory: !!userMemorySummary,
  });

  return { systemPrompt, messageHistory, tools };
}
