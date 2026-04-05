import { SUPPORTED_LANGUAGES, LANGUAGES, DEFAULT_LANGUAGE, isValidLanguage, type SupportedLanguage, type Language } from './types';

// ── Token sets for heuristic language detection ───────────────────────────────
// These are highly-distinctive short-form words unlikely to appear in English.
const HT_TOKENS = new Set([
  'bonjou', 'bonswa', 'mèsi', 'kijan', 'mwen', 'nou', 'yo', 'nan', 'pou', 'ak',
  'poukisa', 'kilè', 'kisa', 'ban', 'ba', 'jodi', 'kote', 'pitit', 'fanmi',
  'zanmi', 'travay', 'lekòl', 'bèl', 'oke', 'wi', 'non', 'sil',
]);
const FR_TOKENS = new Set([
  'bonjour', 'bonsoir', 'merci', 'comment', 'oui', 'je', 'tu', 'vous', 'nous',
  'les', 'des', 'une', 'pour', 'dans', 'avec', 'sur', 'qui', 'salut', 'aide',
  'aidez', 'pourquoi', 'quand', 'où', 'quoi', 'votre', 'notre', 'aussi', 'mais',
  'donc', 'alors', 'très', 'bien', 'suis', 'est', 'sont', 'avez', 'avons',
]);

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

/**
 * Lightweight heuristic language detector for short social-channel messages.
 *
 * Tokenises the input and counts matches against curated French and Haitian
 * Creole word sets. Requires at least 1 match before making a call so that
 * ambiguous short inputs (emojis, numbers, "ok", etc.) stay undefined and fall
 * back gracefully to the session default or 'en'.
 *
 * @returns 'ht' | 'fr' when confident, undefined when inconclusive.
 */
export function detectMessageLanguage(text: string): SupportedLanguage | undefined {
  if (!text.trim()) return undefined;

  // Normalise: lower-case, keep accented chars, split on whitespace/punctuation
  const words = text
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F'àâäéèêëîïôùûüçœæ]/g, ' ')
    .split(/[\s]+/)
    .filter(Boolean);

  if (words.length === 0) return undefined;

  let htScore = 0;
  let frScore = 0;
  for (const w of words) {
    if (HT_TOKENS.has(w)) htScore++;
    if (FR_TOKENS.has(w)) frScore++;
  }

  // No recognisable tokens → inconclusive
  if (htScore === 0 && frScore === 0) return undefined;

  // Haitian Creole tokens are highly specific — any match is a strong signal
  if (htScore > frScore) return 'ht';
  return 'fr';
}
