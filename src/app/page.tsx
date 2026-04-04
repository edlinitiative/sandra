import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* Background glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-sandra-400/20 blur-3xl dark:bg-sandra-500/10" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-sandra-300/15 blur-3xl dark:bg-sandra-600/10" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-sandra-200/20 blur-3xl dark:bg-sandra-400/5" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Hero icon with animated ring */}
        <div className="relative mb-10">
          <div className="absolute -inset-4 animate-pulse rounded-full bg-sandra-400/20 blur-xl dark:bg-sandra-500/15" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-sandra-500 to-sandra-700 text-white shadow-2xl shadow-sandra-500/25 ring-1 ring-white/20">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
              />
            </svg>
          </div>
        </div>

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-sandra-200/60 bg-sandra-50/80 px-3 py-1 text-xs font-medium text-sandra-700 backdrop-blur-sm dark:border-sandra-800 dark:bg-sandra-950/50 dark:text-sandra-300">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sandra-500" />
          AI-Powered Assistant
        </div>

        <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
          Meet <span className="bg-gradient-to-r from-sandra-500 to-sandra-700 bg-clip-text text-transparent">Sandra</span>
        </h1>
        <p className="mb-2 text-lg font-medium text-gray-500 dark:text-gray-400 sm:text-xl">
          The AI assistant for the EdLight ecosystem
        </p>
        <p className="mb-10 max-w-md text-sm leading-relaxed text-gray-400 dark:text-gray-500">
          Navigate EdLight platforms, find documentation, and get answers instantly in
          English, French, and Haitian Creole.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/chat"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sandra-600 to-sandra-700 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sandra-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-sandra-500/30 hover:brightness-110"
          >
            <svg className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
            Start Chatting
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-8 py-3.5 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-gray-300 hover:bg-white hover:shadow-md dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800"
          >
            Admin Panel
          </Link>
        </div>

        {/* Platform cards */}
        <div className="mt-20 grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              name: 'EdLight Code',
              desc: 'Core platform',
              href: 'https://code.edlight.org/',
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
                </svg>
              ),
            },
            {
              name: 'EdLight Academy',
              desc: 'Learning resources',
              href: 'https://academy.edlight.org/',
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
                </svg>
              ),
            },
            {
              name: 'EdLight Initiative',
              desc: 'Organization hub',
              href: 'https://www.edlight.org/',
              icon: (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3c2.7 2.5 4 5.5 4 9s-1.3 6.5-4 9c-2.7-2.5-4-5.5-4-9s1.3-6.5 4-9Z" />
                </svg>
              ),
            },
          ].map((platform) => (
            <a
              key={platform.name}
              href={platform.href}
              className="group relative rounded-2xl border border-gray-200/80 bg-white/70 p-5 text-left shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sandra-500 focus-visible:ring-offset-2 dark:border-gray-700/60 dark:bg-gray-800/60 dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
              aria-label={`Open ${platform.name}`}
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sandra-50 to-sandra-100 text-sandra-600 shadow-sm transition-transform duration-300 group-hover:scale-110 dark:from-sandra-900/50 dark:to-sandra-800/50 dark:text-sandra-400">
                {platform.icon}
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{platform.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{platform.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sandra-600 opacity-0 transition-all duration-300 ease-out group-hover:translate-x-1 group-hover:opacity-100 dark:text-sandra-400">
                Open
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </a>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-20 flex flex-col items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1.5">
              <img src="https://flagcdn.com/w20/us.png" width="16" height="12" alt="US flag" className="rounded-sm" />
              English
            </span>
            <span className="h-3 w-px bg-gray-300 dark:bg-gray-700" />
            <span className="flex items-center gap-1.5">
              <img src="https://flagcdn.com/w20/fr.png" width="16" height="12" alt="France flag" className="rounded-sm" />
              Français
            </span>
            <span className="h-3 w-px bg-gray-300 dark:bg-gray-700" />
            <span className="flex items-center gap-1.5">
              <img src="https://flagcdn.com/w20/ht.png" width="16" height="12" alt="Haiti flag" className="rounded-sm" />
              Kreyòl Ayisyen
            </span>
          </div>
          <p className="text-[11px] text-gray-300 dark:text-gray-600">
            Powered by Sandra AI · EdLight Initiative
          </p>
        </div>
      </div>
    </div>
  );
}
