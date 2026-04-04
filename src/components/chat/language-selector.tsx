'use client';

type Language = 'en' | 'fr' | 'ht';

const LANG_KEY = 'sandra_language';

const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ht', label: 'Kreyòl Ayisyen' },
];

interface LanguageSelectorProps {
  language: Language;
  onChange: (lang: Language) => void;
}

export function LanguageSelector({ language, onChange }: LanguageSelectorProps) {
  const handleChange = (lang: Language) => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // Ignore storage errors
    }
    onChange(lang);
  };

  return (
    <select
      value={language}
      onChange={(e) => handleChange(e.target.value as Language)}
      aria-label="Select language"
      className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-2 py-1 text-xs text-slate-400 focus:outline-none focus:ring-2 focus:ring-sandra-500/20 [color-scheme:dark]"
    >
      {LANGUAGE_OPTIONS.map((opt) => (
        <option key={opt.code} value={opt.code}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
