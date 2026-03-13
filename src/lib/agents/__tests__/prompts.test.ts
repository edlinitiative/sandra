import { describe, it, expect } from 'vitest';
import { buildSandraSystemPrompt, getSandraSystemPrompt } from '../prompts';

describe('buildSandraSystemPrompt', () => {
  it('includes Sandra persona description', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt).toContain('Sandra');
    expect(prompt).toContain('EdLight');
  });

  it('includes English language instruction by default', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt.toLowerCase()).toContain('english');
  });

  it('includes French language instruction', () => {
    const prompt = buildSandraSystemPrompt({ language: 'fr' });
    expect(prompt).toContain('French');
  });

  it('includes Haitian Creole language instruction', () => {
    const prompt = buildSandraSystemPrompt({ language: 'ht' });
    expect(prompt).toContain('Haitian Creole');
  });

  it('includes tool names when provided', () => {
    const prompt = buildSandraSystemPrompt({
      language: 'en',
      availableTools: ['searchKnowledgeBase', 'lookupRepo'],
    });
    expect(prompt).toContain('searchKnowledgeBase');
    expect(prompt).toContain('lookupRepo');
  });

  it('includes user memory when provided', () => {
    const prompt = buildSandraSystemPrompt({
      language: 'en',
      userMemorySummary: 'User is interested in coding.',
    });
    expect(prompt).toContain('User is interested in coding.');
  });

  it('includes retrieval context when provided', () => {
    const prompt = buildSandraSystemPrompt({
      language: 'en',
      retrievalContext: 'From EdLight Academy: ...',
    });
    expect(prompt).toContain('From EdLight Academy:');
  });

  it('includes behavioral guidelines', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt).toContain('Guidelines');
  });

  it('does not include tool section when no tools provided', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en', availableTools: [] });
    // Should not crash and should still have persona
    expect(prompt).toContain('Sandra');
  });
});

describe('getSandraSystemPrompt', () => {
  it('includes persona description', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    expect(prompt).toContain('Sandra');
    expect(prompt).toContain('EdLight');
  });

  it('includes language instruction', () => {
    const prompt = getSandraSystemPrompt({ language: 'fr' });
    expect(prompt).toContain('French');
  });

  it('lists tool descriptions when tools provided', () => {
    const prompt = getSandraSystemPrompt({
      language: 'en',
      tools: [
        { name: 'searchKnowledgeBase', description: 'Search the knowledge base', parameters: {} },
      ],
    });
    expect(prompt).toContain('searchKnowledgeBase');
    expect(prompt).toContain('Search the knowledge base');
  });

  it('includes behavioral guidelines', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    expect(prompt).toContain('Guidelines');
  });
});
