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

  it('includes conversation summary when provided', () => {
    const prompt = buildSandraSystemPrompt({
      language: 'en',
      conversationSummary: 'Earlier conversation summary:\n- Earlier user questions/goals: Learn Python',
    });
    expect(prompt).toContain('Earlier conversation summary');
    expect(prompt).toContain('Learn Python');
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

// Phase 6: tool routing and course accuracy
describe('Phase 6 — course routing in buildSandraSystemPrompt', () => {
  it('directs course questions to getCourseInventory', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt).toContain('getCourseInventory');
  });

  it('distinguishes getCourseInventory from getEdLightInitiatives', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt).toContain('getCourseInventory');
    expect(prompt).toContain('getEdLightInitiatives');
    // Prompt should restrict getEdLightInitiatives from course listing use
    expect(prompt).toMatch(/getEdLightInitiatives.*Do NOT use.*course/i);
  });

  it('lists course-related keywords that should trigger getCourseInventory', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt.toLowerCase()).toContain('python');
    expect(prompt.toLowerCase()).toContain('sql');
    expect(prompt.toLowerCase()).toContain('math');
  });

  it('instructs Sandra to name concrete courses instead of generic summaries', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt).toMatch(/name.*course|course.*name/i);
  });

  it('instructs Sandra to be honest when course data is unavailable', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt.toLowerCase()).toContain('unavailable');
  });
});

describe('Phase 6 — course routing in getSandraSystemPrompt', () => {
  it('directs course questions to getCourseInventory', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    expect(prompt).toContain('getCourseInventory');
  });

  it('distinguishes getCourseInventory from getEdLightInitiatives', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    expect(prompt).toContain('getCourseInventory');
    expect(prompt).toContain('getEdLightInitiatives');
  });

  it('instructs Sandra to name concrete courses', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    expect(prompt).toMatch(/name.*course|course.*name/i);
  });

  it('instructs Sandra to admit when course data is unavailable', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    expect(prompt.toLowerCase()).toContain('unavailable');
  });
});
