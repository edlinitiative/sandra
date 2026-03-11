/**
 * Supported languages for Sandra.
 */

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ht'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export interface LanguageMeta {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const LANGUAGES: Record<SupportedLanguage, LanguageMeta> = {
  en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  ht: { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen', flag: '🇭🇹' },
};
