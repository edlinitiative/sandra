import { vi } from 'vitest';
import type {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from '@/lib/ai/types';

/** Default canned chat completion response */
const defaultChatResponse: ChatCompletionResponse = {
  content: 'This is a mock response.',
  toolCalls: [],
  finishReason: 'stop',
  usage: {
    promptTokens: 10,
    completionTokens: 8,
    totalTokens: 18,
  },
  model: 'mock-model',
};

/** Default canned embedding response (1536-dim zero vector) */
const defaultEmbeddingResponse: EmbeddingResponse = {
  embeddings: [new Array(1536).fill(0) as number[]],
  model: 'mock-embedding-model',
  usage: {
    promptTokens: 5,
    totalTokens: 5,
  },
};

/**
 * Mock AIProvider implementing the AIProvider interface.
 * All methods are vi.fn() stubs with sensible default return values.
 */
export const mockAIProvider: AIProvider = {
  name: 'mock',

  chatCompletion: vi.fn(
    async (_request: ChatCompletionRequest): Promise<ChatCompletionResponse> =>
      ({ ...defaultChatResponse }),
  ),

  generateEmbeddings: vi.fn(
    async (_request: EmbeddingRequest): Promise<EmbeddingResponse> =>
      ({ ...defaultEmbeddingResponse }),
  ),

  healthCheck: vi.fn(async (): Promise<boolean> => true),
};

/** Reset all mock function call history between tests */
export function resetAIProviderMocks(): void {
  const chatMock = mockAIProvider.chatCompletion as ReturnType<typeof vi.fn>;
  const embedMock = mockAIProvider.generateEmbeddings as ReturnType<typeof vi.fn>;
  const healthMock = mockAIProvider.healthCheck as ReturnType<typeof vi.fn>;

  chatMock.mockReset();
  embedMock.mockReset();
  healthMock.mockReset();

  // Restore default implementations after reset
  chatMock.mockImplementation(
    async (_request: ChatCompletionRequest): Promise<ChatCompletionResponse> =>
      ({ ...defaultChatResponse }),
  );
  embedMock.mockImplementation(
    async (_request: EmbeddingRequest): Promise<EmbeddingResponse> =>
      ({ ...defaultEmbeddingResponse }),
  );
  healthMock.mockImplementation(async (): Promise<boolean> => true);
}
