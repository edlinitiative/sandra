/**
 * AI Provider type definitions.
 * Vendor-agnostic interfaces for chat completion and embeddings.
 */

/** Roles in a conversation */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A single message in a conversation */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

/** Tool/function definition for the LLM */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

/** A tool call requested by the model */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

/** Request to the chat completion provider */
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { name: string };
  stop?: string[];
}

/** Response from the chat completion provider */
export interface ChatCompletionResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

/** Request for generating embeddings */
export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
}

/** Response from the embedding provider */
export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/** Interface that all AI providers must implement */
export interface AIProvider {
  readonly name: string;

  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /** Check whether the provider is configured and reachable */
  healthCheck(): Promise<boolean>;
}
