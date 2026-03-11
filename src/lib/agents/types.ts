import type { SupportedLanguage } from '@/lib/i18n/types';
import type { ChannelType } from '@/lib/channels/types';
import type { ChatMessage, ToolCall } from '@/lib/ai/types';

/**
 * Agent system type definitions.
 */

/** Input to the Sandra agent */
export interface AgentInput {
  message: string;
  sessionId: string;
  userId?: string;
  language: SupportedLanguage;
  channel: ChannelType;
  metadata?: Record<string, unknown>;
}

/** Output from the Sandra agent */
export interface AgentOutput {
  response: string;
  language: SupportedLanguage;
  toolsUsed: string[];
  retrievalUsed: boolean;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

/** Internal state during agent execution */
export interface AgentState {
  messages: ChatMessage[];
  toolCalls: ToolCall[];
  toolResults: Map<string, string>;
  retrievalContext: string;
  iterations: number;
  maxIterations: number;
}

/** Configuration for the agent */
export interface AgentConfig {
  maxIterations: number;
  temperature: number;
  maxTokens: number;
  enableRetrieval: boolean;
  enableTools: boolean;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxIterations: 5,
  temperature: 0.7,
  maxTokens: 2048,
  enableRetrieval: true,
  enableTools: true,
};
