import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12 text-center">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(56,157,246,0.10),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_80%_80%,rgba(34,211,238,0.04),transparent)]" />

      {/* Hero orb — abstract neural mark */}
      <div className="relative z-10 mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sandra-400 to-sandra-700 animate-glow-pulse animate-orb-float shadow-2xl">
        <svg className="h-14 w-14" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="4" fill="white" fillOpacity="0.9" />
          <circle cx="16" cy="16" r="8" stroke="white" strokeOpacity="0.45" strokeWidth="1.5" fill="none" />
          <circle cx="16" cy="16" r="12" stroke="white" strokeOpacity="0.2" strokeWidth="1" fill="none" strokeDasharray="4 6" />
          <line x1="16" y1="2" x2="16" y2="8" stroke="white" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
          <line x1="16" y1="24" x2="16" y2="30" stroke="white" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
          <line x1="2" y1="16" x2="8" y2="16" stroke="white" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
          <line x1="24" y1="16" x2="30" y2="16" stroke="white" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </div>

      <h1 className="relative z-10 mb-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
        Meet{' '}
        <span className="bg-gradient-to-r from-sandra-300 to-sandra-500 bg-clip-text text-transparent">
          Sandra
        </span>
      </h1>
      <p className="relative z-10 mb-2 text-lg text-slate-400 sm:text-xl">
        The AI assistant for the EdLight ecosystem
      </p>
      <p className="relative z-10 mb-8 max-w-lg text-sm text-slate-500">
        Fluent in English, French, and Haitian Creole — here to help you navigate EdLight
        platforms, find programs, and get answers instantly.
      </p>

      <div className="relative z-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/chat"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sandra-600 to-sandra-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all glow-blue-sm hover:glow-blue active:scale-[0.98]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
          Talk to Sandra
        </Link>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 glass px-8 py-3 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-white active:scale-[0.98]"
        >
          Admin Panel
        </Link>
      </div>

      {/* Platform cards */}
      <div className="relative z-10 mt-16 grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            className="group glass rounded-2xl p-4 text-left transition-all duration-300 hover:border-sandra-500/30 hover:bg-white/[0.07] hover:glow-blue-sm active:scale-[0.98]"
            aria-label={`Open ${platform.name}`}
          >
            <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sandra-500/15 text-sandra-400">
              {platform.icon}
            </div>
            <p className="text-sm font-semibold text-slate-200">{platform.name}</p>
            <p className="text-xs text-slate-500">{platform.desc}</p>
            <span className="mt-3 inline-flex items-center text-xs font-medium text-sandra-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              Open →
            </span>
          </a>
        ))}
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-16 text-xs text-slate-600">
        Sandra speaks 🇺🇸 English · 🇫🇷 Français · 🇭🇹 Kreyòl Ayisyen
      </p>
    </div>
  );
}
