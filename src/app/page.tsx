import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      {/* Sandra mark */}
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sandra-500 to-sandra-700">
        <svg className="h-7 w-7" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="4" fill="white" fillOpacity="0.9" />
          <circle cx="16" cy="16" r="8" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
          <circle cx="16" cy="16" r="12" stroke="white" strokeOpacity="0.15" strokeWidth="1" fill="none" strokeDasharray="4 6" />
        </svg>
      </div>

      <h1 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Meet{' '}
        <span className="bg-gradient-to-r from-sandra-300 to-sandra-500 bg-clip-text text-transparent">
          Sandra
        </span>
      </h1>
      <p className="mb-2 text-base text-slate-400 sm:text-lg">
        The AI assistant for the EdLight ecosystem
      </p>
      <p className="mb-8 max-w-sm text-sm leading-relaxed text-slate-600">
        Fluent in English, French, and Haitian Creole — here to help you
        navigate programs, find answers, and get things done.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/chat"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-all hover:bg-slate-200 active:scale-[0.97]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
          Talk to Sandra
        </Link>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.1] px-7 py-3 text-sm font-medium text-slate-400 transition-all hover:border-white/[0.2] hover:text-white active:scale-[0.97]"
        >
          Admin Panel
        </Link>
      </div>

      {/* Platform cards */}
      <div className="mt-14 grid w-full max-w-lg gap-2 sm:max-w-3xl sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            name: 'EdLight Code',
            desc: 'Core platform',
            href: 'https://code.edlight.org/',
            icon: (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
              </svg>
            ),
          },
          {
            name: 'EdLight Academy',
            desc: 'Learning resources',
            href: 'https://academy.edlight.org/',
            icon: (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14 3 9l9-5 9 5-9 5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12v4c0 1 2.5 2 5 2s5-1 5-2v-4" />
              </svg>
            ),
          },
          {
            name: 'EdLight News',
            desc: 'Community updates',
            href: 'https://news.edlight.org/',
            icon: (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
              </svg>
            ),
          },
          {
            name: 'EdLight Initiative',
            desc: 'Organization hub',
            href: 'https://www.edlight.org/',
            icon: (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3c2.7 2.5 4 5.5 4 9s-1.3 6.5-4 9c-2.7-2.5-4-5.5-4-9s1.3-6.5 4-9Z" />
              </svg>
            ),
          },
        ].map((platform) => (
          <a
            key={platform.name}
            href={platform.href}
            className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition-all hover:border-white/[0.12] hover:bg-white/[0.04] active:scale-[0.98]"
            aria-label={`Open ${platform.name}`}
          >
            <div className="mb-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400">
              {platform.icon}
            </div>
            <p className="text-sm font-medium text-slate-200">{platform.name}</p>
            <p className="text-xs text-slate-600">{platform.desc}</p>
          </a>
        ))}
      </div>

      {/* Footer */}
      <p className="mt-14 text-[11px] text-slate-700">
        🇺🇸 English · 🇫🇷 Français · 🇭🇹 Kreyòl Ayisyen
      </p>
    </div>
  );
}
