/**
 * Tests for the context window manager.
 */
import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateMessagesTokens,
  calculateContextBudget,
  optimizeContextWindow,
} from '../context-manager';
import type { ChatMessage } from '@/lib/ai/types';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates ~1 token per 4 characters', () => {
    const text = 'a'.repeat(100);
    expect(estimateTokens(text)).toBe(25);
  });

  it('rounds up fractional tokens', () => {
    expect(estimateTokens('hello')).toBe(2); // 5 chars / 4 = 1.25 → 2
  });
});

describe('estimateMessagesTokens', () => {
  it('returns 0 for empty array', () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });

  it('includes per-message overhead', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
    ];
    const tokens = estimateMessagesTokens(messages);
    // 5 chars / 4 = 2 tokens + 4 overhead = 6
    expect(tokens).toBe(6);
  });

  it('sums all messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'a'.repeat(40) }, // 10 + 4
      { role: 'assistant', content: 'b'.repeat(80) }, // 20 + 4
    ];
    const tokens = estimateMessagesTokens(messages);
    expect(tokens).toBe(38); // 14 + 24
  });
});

describe('calculateContextBudget', () => {
  it('returns withinBudget true when total fits', () => {
    const budget = calculateContextBudget({
      systemPrompt: 'a'.repeat(100),
      retrievalContext: 'b'.repeat(100),
      historyMessages: [{ role: 'user', content: 'hello' }],
      userMessage: 'question',
    });

    expect(budget.withinBudget).toBe(true);
    expect(budget.systemPromptTokens).toBe(25);
    expect(budget.totalTokens).toBeLessThan(budget.maxTokens);
  });

  it('returns withinBudget false when exceeding max', () => {
    const budget = calculateContextBudget({
      systemPrompt: 'a'.repeat(10000),
      retrievalContext: 'b'.repeat(10000),
      historyMessages: Array.from({ length: 50 }, () => ({
        role: 'user' as const,
        content: 'c'.repeat(400),
      })),
      userMessage: 'd'.repeat(1000),
      maxTokens: 100,
    });

    expect(budget.withinBudget).toBe(false);
  });
});

describe('optimizeContextWindow', () => {
  it('returns all messages when history fits', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];

    const result = optimizeContextWindow({
      systemPrompt: 'You are Sandra.',
      retrievalContext: '',
      historyMessages: history,
      userMessage: 'question',
    });

    // system + 2 history + user = 4
    expect(result).toHaveLength(4);
    expect(result[0]!.role).toBe('system');
    expect(result[result.length - 1]!.role).toBe('user');
    expect(result[result.length - 1]!.content).toBe('question');
  });

  it('trims old messages when budget exceeded', () => {
    // Create a very long history that exceeds the budget
    const history: ChatMessage[] = Array.from({ length: 100 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as ChatMessage['role'],
      content: `Message ${i}: ${'x'.repeat(200)}`,
    }));

    const result = optimizeContextWindow({
      systemPrompt: 'You are Sandra.',
      retrievalContext: 'Some retrieval context here.',
      historyMessages: history,
      userMessage: 'What is EdLight?',
      maxContextTokens: 2000,
    });

    // Should have fewer messages than original + system + user
    expect(result.length).toBeLessThan(history.length + 2);
    // Must still have system prompt and user message
    expect(result[0]!.role).toBe('system');
    expect(result[result.length - 1]!.role).toBe('user');
    expect(result[result.length - 1]!.content).toBe('What is EdLight?');
  });

  it('injects conversation summary when trimming', () => {
    const history: ChatMessage[] = Array.from({ length: 100 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as ChatMessage['role'],
      content: `Message ${i}: ${'x'.repeat(200)}`,
    }));

    const result = optimizeContextWindow({
      systemPrompt: 'You are Sandra.',
      retrievalContext: '',
      historyMessages: history,
      userMessage: 'question',
      conversationSummary: 'Earlier: user asked about EdLight courses.',
      maxContextTokens: 2000,
    });

    // Summary should appear as a system message after the main system prompt
    const systemMessages = result.filter((m) => m.role === 'system');
    expect(systemMessages.length).toBeGreaterThanOrEqual(1);
    const hasSummary = result.some(
      (m) => m.role === 'system' && m.content.includes('EdLight courses'),
    );
    expect(hasSummary).toBe(true);
  });

  it('includes retrieval context in system prompt', () => {
    const result = optimizeContextWindow({
      systemPrompt: 'You are Sandra.',
      retrievalContext: 'Context from knowledge base.',
      historyMessages: [],
      userMessage: 'hello',
    });

    expect(result[0]!.content).toContain('You are Sandra.');
    expect(result[0]!.content).toContain('Context from knowledge base.');
  });
});
