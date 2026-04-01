/**
 * AI Provider type definitions.
 * Vendor-agnostic interfaces for chat completion and embeddings.
 */

/** Roles in a conversation */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A tool call requested by the model */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

/** A single part of a multimodal user message (text or image for vision) */
export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

/** A single message in a conversation */
export interface ChatMessage {
  role: MessageRole;
  /** String for all roles; content-part array only for user messages with vision attachments */
  content: string | MessageContentPart[];
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

/** Tool/function definition for the LLM */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
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

/** A single chunk from a streaming chat completion */
export interface StreamChunk {
  /** Incremental content delta, or null if this chunk carries only tool calls */
  content: string | null;
  /** Accumulated tool calls at stream end, or null during content streaming */
  toolCalls: ToolCall[] | null;
  /** True on the final chunk when streaming is complete */
  done: boolean;
}

/** Interface that all AI providers must implement */
export interface AIProvider {
  readonly name: string;

  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  streamChatCompletion(request: ChatCompletionRequest): AsyncIterable<StreamChunk>;
  generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  /** Convenience method: generate a single embedding vector for one text */
  generateEmbedding(text: string): Promise<number[]>;

  /** Check whether the provider is configured and reachable */
  healthCheck(): Promise<boolean>;
}
