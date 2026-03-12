import { SUPPORTED_LANGUAGES, LANGUAGES, DEFAULT_LANGUAGE, isValidLanguage, type SupportedLanguage, type Language } from './types';

/**
 * Resolve the language for a request.
 * Priority: explicit parameter > session preference > DEFAULT_LANGUAGE.
 */
export function resolveLanguage(params: { explicit?: string; sessionLanguage?: string }): Language {
  const { explicit, sessionLanguage } = params;
  if (explicit && isValidLanguage(explicit)) return explicit;
  if (sessionLanguage && isValidLanguage(sessionLanguage)) return sessionLanguage;
  return DEFAULT_LANGUAGE;
}

/**
 * Normalize a raw language code string to a SupportedLanguage.
 * Handles common variants; falls back to 'en'.
 */
export function normalizeLanguageCode(code: string | null | undefined): SupportedLanguage {
  if (!code) return 'en';
  const normalized = code.toLowerCase().trim().slice(0, 2);
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(normalized)) {
    return normalized as SupportedLanguage;
  }
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
 * Get the system prompt language instruction for Sandra.
 */
export function getLanguageInstruction(language: Language): string {
  switch (language) {
    case 'ht':
      return `You MUST respond in Haitian Creole (Kreyòl Ayisyen). All output must be in Haitian Creole.`;
    case 'fr':
      return `You MUST respond in French (Français). All output must be in French.`;
    default:
      return `Respond in English.`;
  }
}

/**
 * Generate the language instruction for Sandra's system prompt.
 * @deprecated Use getLanguageInstruction instead.
 */
export function languagePromptInstruction(language: SupportedLanguage): string {
  switch (language) {
    case 'ht':
      return `IMPORTANT: The user's preferred language is Haitian Creole (Kreyòl Ayisyen). You MUST respond in Haitian Creole. Be natural and conversational in Kreyòl.`;
    case 'fr':
      return `IMPORTANT: The user's preferred language is French (Français). You MUST respond in French. Be natural and conversational in French.`;
    default:
      return `Respond in English. Be clear and conversational.`;
  }
}
