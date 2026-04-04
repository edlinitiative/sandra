import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12 text-center cyber-grid">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(56,157,246,0.12),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_80%_80%,rgba(34,211,238,0.05),transparent)]" />

      {/* Hero orb */}
      <div className="relative z-10 mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-sandra-400 to-sandra-700 animate-glow-pulse animate-orb-float shadow-2xl">
        <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
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
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
          Start Chatting
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
