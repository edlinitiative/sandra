/**
 * V2 Phase 1 — Tool Routing Benchmark Prompts
 *
 * These tests document and verify the expected tool routing behavior for
 * representative user prompts. They test the system prompt's routing
 * instructions, not LLM inference (no network calls).
 *
 * Benchmark categories:
 *   A. Course listing → getCourseInventory
 *   B. Platform overview → getEdLightInitiatives
 *   C. Repo/code → lookupRepoInfo
 *   D. Documentation → searchKnowledgeBase
 *   E. Negative: getEdLightInitiatives must NOT handle course questions
 */

import { describe, it, expect } from 'vitest';
import { buildSandraSystemPrompt, getSandraSystemPrompt } from '../prompts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the routing section of the prompt (the Guidelines block).
 * We parse out the text after "Guidelines:" to keep assertions focused.
 */
function getRoutingSection(prompt: string): string {
  const idx = prompt.indexOf('Guidelines:');
  return idx >= 0 ? prompt.slice(idx) : prompt;
}

// ---------------------------------------------------------------------------
// Category A — Course listing queries should route to getCourseInventory
// ---------------------------------------------------------------------------

describe('Benchmark A — course listing prompts → getCourseInventory', () => {
  const prompts = [
    'What courses are on EdLight Academy?',
    'What courses are available on EdLight Code?',
    'What can I learn on EdLight?',
    'Where should a beginner start?',
    'Show me Python courses',
    'Do you have any SQL courses?',
    'What Excel lessons are available?',
    'List all courses on Academy',
    'I want to learn web development — what modules exist?',
    'What 3D design course is offered?',
  ];

  it.each(prompts)('system prompt routes "%s" → getCourseInventory', (userPrompt) => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    const routing = getRoutingSection(prompt);

    // The prompt must name getCourseInventory as the correct tool
    expect(routing).toContain('getCourseInventory');

    // Extract at least one keyword from the user prompt that the routing section covers
    const courseKeywords = ['course', 'learn', 'lesson', 'module', 'python', 'sql', 'excel', '3d', 'web', 'beginner'];
    const promptLower = userPrompt.toLowerCase();
    const matchedKeyword = courseKeywords.find((kw) => promptLower.includes(kw));

    // Each benchmark prompt must contain at least one keyword that the routing rules mention
    expect(matchedKeyword).toBeTruthy();
    if (matchedKeyword) {
      expect(routing.toLowerCase()).toContain(matchedKeyword);
    }
  });
});

// ---------------------------------------------------------------------------
// Category B — Platform overview queries should route to getEdLightInitiatives
// ---------------------------------------------------------------------------

describe('Benchmark B — platform overview prompts → getEdLightInitiatives', () => {
  it('system prompt names getEdLightInitiatives for ecosystem overview questions', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    const routing = getRoutingSection(prompt);
    expect(routing).toContain('getEdLightInitiatives');
    // It should be scoped to "ecosystem overview" or "what EdLight is"
    expect(routing.toLowerCase()).toMatch(/ecosystem|overview|what edlight is|platforms exist/);
  });

  it('getSandraSystemPrompt names getEdLightInitiatives for ecosystem overview', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    const routing = getRoutingSection(prompt);
    expect(routing).toContain('getEdLightInitiatives');
    expect(routing.toLowerCase()).toMatch(/ecosystem|overview/);
  });
});

// ---------------------------------------------------------------------------
// Category C — Repo/code queries
// ---------------------------------------------------------------------------

describe('Benchmark C — repo queries → lookupRepoInfo', () => {
  it('system prompt names lookupRepoInfo for repository questions', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    const routing = getRoutingSection(prompt);
    expect(routing).toContain('lookupRepoInfo');
    expect(routing.toLowerCase()).toMatch(/repo|repositor/);
  });
});

// ---------------------------------------------------------------------------
// Category D — Documentation queries
// ---------------------------------------------------------------------------

describe('Benchmark D — documentation queries → searchKnowledgeBase', () => {
  it('system prompt names searchKnowledgeBase for documentation questions', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    const routing = getRoutingSection(prompt);
    expect(routing).toContain('searchKnowledgeBase');
    expect(routing.toLowerCase()).toMatch(/document|knowledge|detail/);
  });
});

// ---------------------------------------------------------------------------
// Category E — Negative: getEdLightInitiatives must NOT handle course listings
// ---------------------------------------------------------------------------

describe('Benchmark E — getEdLightInitiatives must NOT be used for course questions', () => {
  it('buildSandraSystemPrompt explicitly restricts getEdLightInitiatives from course listing', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    const routing = getRoutingSection(prompt);
    // Must contain the "Do NOT use" restriction
    expect(routing).toMatch(/getEdLightInitiatives.*Do NOT use.*course/i);
  });

  it('getSandraSystemPrompt explicitly restricts getEdLightInitiatives from course listing', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    const routing = getRoutingSection(prompt);
    expect(routing).toMatch(/getEdLightInitiatives.*Do NOT use.*course/i);
  });

  it('routing instructions distinguish course tool from platform overview tool', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    const routing = getRoutingSection(prompt);
    // getCourseInventory is the primary tool for courses
    const courseToolIdx = routing.indexOf('getCourseInventory');
    const initiativesToolIdx = routing.indexOf('getEdLightInitiatives');
    // Both tools must be mentioned
    expect(courseToolIdx).toBeGreaterThanOrEqual(0);
    expect(initiativesToolIdx).toBeGreaterThanOrEqual(0);
    // getCourseInventory is mentioned before getEdLightInitiatives (primary routing order)
    expect(courseToolIdx).toBeLessThan(initiativesToolIdx);
  });
});

// ---------------------------------------------------------------------------
// Category F — Platform-specific course routing (academy vs code)
// ---------------------------------------------------------------------------

describe('Benchmark F — platform-specific course routing', () => {
  it("prompt encodes 'academy' as a valid platform parameter for getCourseInventory", () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt.toLowerCase()).toContain('academy');
  });

  it("prompt encodes 'code' as a valid platform parameter for getCourseInventory", () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    // "EdLight Code" appears in the identity + routing examples
    expect(prompt.toLowerCase()).toContain('code');
  });

  it('prompt includes beginner routing example', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt.toLowerCase()).toContain('beginner');
  });
});

// ---------------------------------------------------------------------------
// Category G — Grounded response requirements
// ---------------------------------------------------------------------------

describe('Benchmark G — response accuracy requirements in prompt', () => {
  it('buildSandraSystemPrompt instructs Sandra to name actual courses (not generic summaries)', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt).toMatch(/name.*course|course.*name/i);
  });

  it('getSandraSystemPrompt instructs Sandra to name actual courses', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    expect(prompt).toMatch(/name.*course|course.*name/i);
  });

  it('buildSandraSystemPrompt instructs Sandra to admit when data is unavailable', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt.toLowerCase()).toContain('unavailable');
  });

  it('getSandraSystemPrompt instructs Sandra to admit when data is unavailable', () => {
    const prompt = getSandraSystemPrompt({ language: 'en' });
    expect(prompt.toLowerCase()).toContain('unavailable');
  });

  it('buildSandraSystemPrompt instructs Sandra to be honest about missing information', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt.toLowerCase()).toMatch(/honest|don.*know|say so|making things up/);
  });
});
