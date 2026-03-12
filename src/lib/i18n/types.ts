/**
 * Supported languages for Sandra.
 */

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ht'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Alias for SupportedLanguage — preferred in new code */
export type Language = SupportedLanguage;

/** Default language when none specified */
export const DEFAULT_LANGUAGE: Language = 'en';

export interface LanguageMeta {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

/** Language configuration with UI strings */
export interface LanguageConfig {
  code: Language;
  name: string;
  nativeName: string;
  direction: 'ltr';
  greeting: string;
}

export const LANGUAGES: Record<SupportedLanguage, LanguageMeta> = {
  en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  ht: { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen', flag: '🇭🇹' },
};

export const LANGUAGE_CONFIGS: Record<Language, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    greeting: "Hello! I'm Sandra, the AI assistant for the EdLight ecosystem. How can I help you today?",
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    greeting: "Bonjour ! Je suis Sandra, l'assistante IA de l'écosystème EdLight. Comment puis-je vous aider ?",
  },
  ht: {
    code: 'ht',
    name: 'Haitian Creole',
    nativeName: 'Kreyòl Ayisyen',
    direction: 'ltr',
    greeting: "Bonjou! Mwen se Sandra, asistan IA ekosistèm EdLight la. Kijan mwen ka ede ou jodi a?",
  },
};

/**
 * Type guard: returns true if str is a valid Language code.
 */
export function isValidLanguage(str: unknown): str is Language {
  return typeof str === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(str);
}
