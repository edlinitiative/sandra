import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAIProvider, registerAIProvider } from '../provider';
import type { AIProvider } from '../types';

describe('getAIProvider', () => {
  it('returns an AIProvider instance for openai', () => {
    const provider = getAIProvider('openai');
    expect(provider).toBeDefined();
    expect(provider.name).toBe('openai');
  });

  it('returns the same instance on repeated calls (singleton)', () => {
    const p1 = getAIProvider('openai');
    const p2 = getAIProvider('openai');
    expect(p1).toBe(p2);
  });

  it('throws for unknown provider names', () => {
    expect(() => getAIProvider('unknown' as never)).toThrow();
  });
});

describe('registerAIProvider', () => {
  it('allows registering a custom provider', () => {
    const mockProvider: AIProvider = {
      name: 'custom',
      chatCompletion: vi.fn(),
      streamChatCompletion: vi.fn(),
      generateEmbeddings: vi.fn(),
      generateEmbedding: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue(true),
    };

    registerAIProvider('custom', () => mockProvider);
    const provider = getAIProvider('custom' as never);
    expect(provider.name).toBe('custom');
  });
});
