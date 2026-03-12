import { describe, it, expect } from 'vitest';
import { mockAIProvider } from '@/lib/__tests__/mocks/ai-provider';

describe('mock AIProvider shape', () => {
  it('chatCompletion returns a valid ChatCompletionResponse shape', async () => {
    const response = await mockAIProvider.chatCompletion({
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(response.content).toBeDefined();
    expect(Array.isArray(response.toolCalls)).toBe(true);
    expect(typeof response.finishReason).toBe('string');
    expect(typeof response.usage.promptTokens).toBe('number');
    expect(typeof response.usage.completionTokens).toBe('number');
    expect(typeof response.usage.totalTokens).toBe('number');
    expect(typeof response.model).toBe('string');
  });

  it('generateEmbeddings returns a valid EmbeddingResponse shape', async () => {
    const response = await mockAIProvider.generateEmbeddings({ input: 'test text' });

    expect(Array.isArray(response.embeddings)).toBe(true);
    expect(response.embeddings[0]).toHaveLength(1536);
    expect(typeof response.model).toBe('string');
    expect(typeof response.usage.promptTokens).toBe('number');
  });

  it('healthCheck returns a boolean', async () => {
    const result = await mockAIProvider.healthCheck();
    expect(typeof result).toBe('boolean');
  });

  it('has a name property', () => {
    expect(typeof mockAIProvider.name).toBe('string');
  });
});
