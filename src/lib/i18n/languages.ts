import { SUPPORTED_LANGUAGES, LANGUAGES, type SupportedLanguage } from './types';

/**
 * Validate and normalize a language code.
 * Falls back to English if the code is unsupported.
 */
export function resolveLanguage(code: string | null | undefined): SupportedLanguage {
  if (!code) return 'en';
  const normalized = code.toLowerCase().trim().slice(0, 2);
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(normalized)) {
    return normalized as SupportedLanguage;
  }
  // Handle common variants
  if (normalized === 'kr' || code.toLowerCase().startsWith('ht')) return 'ht';
  return 'en';
}

/**
 * Get display information for a language.
 */
export function getLanguageInfo(code: SupportedLanguage) {
  return LANGUAGES[code];
}

/**
 * Generate the language instruction for Sandra's system prompt.
 */
export function languagePromptInstruction(language: SupportedLanguage): string {
  const info = LANGUAGES[language];
  switch (language) {
    case 'ht':
      return `IMPORTANT: The user's preferred language is Haitian Creole (Kreyòl Ayisyen). You MUST respond in Haitian Creole. Be natural and conversational in Kreyòl.`;
    case 'fr':
      return `IMPORTANT: The user's preferred language is French (Français). You MUST respond in French. Be natural and conversational in French.`;
    default:
      return `Respond in English. Be clear and conversational.`;
  }
}
