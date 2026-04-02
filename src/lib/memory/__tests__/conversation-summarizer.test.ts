/**
 * Tests for the AI-powered conversation summarizer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeConversation, needsAISummarization } from '../conversation-summarizer';

// Mock the AI provider
vi.mock('@/lib/ai', () => ({
  getAIProvider: () => ({
    chatCompletion: vi.fn().mockResolvedValue({
      content: 'The user asked about EdLight Academy courses and scholarships.',
      toolCalls: [],
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
    }),
  }),
}));

describe('needsAISummarization', () => {
  it('returns false for short conversations', () => {
    expect(needsAISummarization(10)).toBe(false);
    expect(needsAISummarization(20)).toBe(false);
    expect(needsAISummarization(30)).toBe(false);
  });

  it('returns true for long conversations', () => {
    expect(needsAISummarization(31)).toBe(true);
    expect(needsAISummarization(50)).toBe(true);
  });
});

describe('summarizeConversation', () => {
  it('returns empty string for very short conversations', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi!' },
    ];

    return summarizeConversation(messages).then((result) => {
      // Short conversations don't need summarization
      expect(result).toBe('');
    });
  });

  it('uses rule-based summary for medium conversations', () => {
    // Create 25 user-facing messages (below AI threshold of 30)
    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message number ${i}`,
    }));

    return summarizeConversation(messages).then((result) => {
      // Should use rule-based (buildConversationSummary)
      // For 25 messages with MAX_CONTEXT_MESSAGES=20, this should produce a summary
      expect(typeof result).toBe('string');
    });
  });

  it('uses AI summarization for long conversations', () => {
    // Create 40 user-facing messages (above AI threshold of 30)
    const messages = Array.from({ length: 40 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Long conversation message ${i} with enough detail to be meaningful`,
    }));

    return summarizeConversation(messages).then((result) => {
      expect(result).toContain('Earlier conversation summary:');
      expect(result).toContain('EdLight Academy');
    });
  });

  it('filters out non-user-facing messages', () => {
    const messages = [
      { role: 'system' as const, content: 'You are Sandra' },
      { role: 'user' as const, content: 'Hello' },
      { role: 'tool' as const, content: '{"data": "result"}' },
      { role: 'assistant' as const, content: 'Hi there!' },
    ];

    return summarizeConversation(messages).then((result) => {
      // Only 2 user-facing messages — too short to summarize
      expect(result).toBe('');
    });
  });
});
