'use client';

const LANG_KEY = 'sandra_language';

function setLanguage(lang: string) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Storage may be unavailable
  }
  window.location.reload();
}

export function FooterLanguages() {
  return (
    <>
      <button
        type="button"
        onClick={() => setLanguage('fr')}
        className="cursor-pointer text-sm text-on-surface-variant/40 transition-all hover:text-primary"
      >
        Fran&ccedil;ais
      </button>
      <button
        type="button"
        onClick={() => setLanguage('ht')}
        className="cursor-pointer text-sm text-on-surface-variant/40 transition-all hover:text-primary"
      >
        Krey&ograve;l Ayisyen
      </button>
    </>
  );
}
