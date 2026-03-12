import { describe, it, expect } from 'vitest';
import { getSandraSystemPrompt, buildSandraSystemPrompt } from '@/lib/agents/prompts';
import type { ToolDefinition } from '@/lib/ai/types';

describe('getSandraSystemPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('contains French language instruction for fr', () => {
    const prompt = getSandraSystemPrompt({ language: 'fr' });
    expect(prompt).toContain('French');
  });

  it('contains Haitian Creole instruction for ht', () => {
    const prompt = getSandraSystemPrompt({ language: 'ht' });
    expect(prompt).toContain('Haitian Creole');
  });

  it('includes tool names when tools are provided', () => {
    const tools: ToolDefinition[] = [
      { name: 'searchKnowledgeBase', description: 'Search the knowledge base', parameters: {} },
      { name: 'lookupRepoInfo', description: 'Get repo information', parameters: {} },
    ];
    const prompt = getSandraSystemPrompt({ language: 'en', tools });
    expect(prompt).toContain('searchKnowledgeBase');
    expect(prompt).toContain('lookupRepoInfo');
  });

  it('does not include tool section when no tools', () => {
    const prompt = getSandraSystemPrompt({ language: 'en', tools: [] });
    // Should not reference tools since list is empty
    expect(prompt).not.toContain('You have access to the following tools');
  });
});

describe('buildSandraSystemPrompt', () => {
  it('returns a non-empty string for each language', () => {
    for (const lang of ['en', 'fr', 'ht'] as const) {
      const prompt = buildSandraSystemPrompt({ language: lang });
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(50);
    }
  });

  it('includes user memory when provided', () => {
    const prompt = buildSandraSystemPrompt({
      language: 'en',
      userMemorySummary: 'User prefers concise answers',
    });
    expect(prompt).toContain('User prefers concise answers');
  });

  it('includes retrieval context when provided', () => {
    const prompt = buildSandraSystemPrompt({
      language: 'en',
      retrievalContext: 'Relevant doc: EdLight Academy',
    });
    expect(prompt).toContain('EdLight Academy');
  });

  it('includes available tool names when provided', () => {
    const prompt = buildSandraSystemPrompt({
      language: 'en',
      availableTools: ['searchKnowledgeBase'],
    });
    expect(prompt).toContain('searchKnowledgeBase');
  });
});
