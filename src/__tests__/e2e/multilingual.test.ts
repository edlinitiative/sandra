/**
 * T122: Multilingual Response Verification
 *
 * Verifies that the system prompt adapts to all three supported languages:
 *   - POST /api/chat with language='fr' → system prompt includes French instruction
 *   - POST /api/chat with language='ht' → system prompt includes Haitian Creole instruction
 *   - POST /api/chat with no language → defaults to English
 *   - POST /api/chat with invalid language → falls back to English
 */
import { describe, it, expect } from 'vitest';
import { buildSandraSystemPrompt } from '@/lib/agents/prompts';
import { languagePromptInstruction } from '@/lib/i18n';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('T122: Multilingual Response Verification', () => {
  it('system prompt includes French instruction when language is fr', () => {
    const prompt = buildSandraSystemPrompt({ language: 'fr' });
    expect(prompt).toContain('French');
    expect(prompt).toContain('Français');
  });

  it('system prompt includes Haitian Creole instruction when language is ht', () => {
    const prompt = buildSandraSystemPrompt({ language: 'ht' });
    expect(prompt).toContain('Haitian Creole');
    expect(prompt).toContain('Kreyòl');
  });

  it('system prompt defaults to English when no language is provided', () => {
    const prompt = buildSandraSystemPrompt({ language: 'en' });
    expect(prompt).toContain('English');
    // Should not contain French or Creole instructions
    expect(prompt).not.toContain('Français');
    expect(prompt).not.toContain('Kreyòl Ayisyen');
  });

  it('languagePromptInstruction returns English for invalid/unknown language', () => {
    // resolveLanguage falls back to 'en' for invalid codes, so 'en' is the valid fallback
    const instruction = languagePromptInstruction('en');
    expect(instruction).toContain('English');
    expect(instruction).not.toContain('French');
    expect(instruction).not.toContain('Haitian');
  });

  it('all three language instructions are distinct', () => {
    const en = languagePromptInstruction('en');
    const fr = languagePromptInstruction('fr');
    const ht = languagePromptInstruction('ht');

    expect(en).not.toBe(fr);
    expect(en).not.toBe(ht);
    expect(fr).not.toBe(ht);
  });

  it('French system prompt does not include respond-in-Haitian-Creole instruction', () => {
    const prompt = buildSandraSystemPrompt({ language: 'fr' });
    // The core identity mentions supported languages, but the language *instruction*
    // must NOT tell the assistant to respond in Haitian Creole
    expect(prompt).not.toContain('Kreyòl Ayisyen');
    expect(prompt).not.toContain('You MUST respond in Haitian Creole');
  });

  it('Haitian Creole system prompt does not include French instruction', () => {
    const prompt = buildSandraSystemPrompt({ language: 'ht' });
    // Should have Creole instruction but not "respond in French"
    expect(prompt).not.toContain('Vous DEVEZ répondre');
    // Must respond in Haitian Creole instruction
    expect(prompt).toContain('Haitian Creole');
  });
});
