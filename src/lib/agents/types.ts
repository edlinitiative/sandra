import type { SupportedLanguage } from '@/lib/i18n/types';
import type { ChannelType, MessageAttachment } from '@/lib/channels/types';
import type { ChatMessage, ToolCall, ToolDefinition } from '@/lib/ai/types';

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
  /** Display name of the person messaging (used for personalisation on social channels) */
  senderName?: string;
  /** Image attachments to pass to gpt-4o vision (base64 data URLs from WhatsApp/Instagram) */
  attachments?: MessageAttachment[];
  /** Permission scopes for tool execution. Defaults to ['knowledge:read', 'repos:read'] */
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

/** Output from the Sandra agent */
export interface AgentOutput {
  response: string;
  language: SupportedLanguage;
  toolsUsed: string[];
  retrievalUsed: boolean;
  suggestedFollowUps?: string[];
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

/** Assembled context for an agent turn */
export interface AgentContext {
  systemPrompt: string;
  messageHistory: ChatMessage[];
  tools: ToolDefinition[];
}

/** A streaming event from the Sandra agent */
export type AgentStreamEvent =
  | { type: 'token'; data: string }
  | { type: 'tool_call'; data: string }
  | { type: 'tool_result'; data: string }
  | {
      type: 'done';
      data: {
        sessionId: string;
        response: string;
        toolsUsed: string[];
        retrievalUsed: boolean;
        suggestedFollowUps: string[];
      };
    }
  | { type: 'error'; data: string };
