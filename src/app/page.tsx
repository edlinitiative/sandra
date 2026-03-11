import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      {/* Hero */}
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-sandra-500 to-sandra-700 text-white shadow-xl">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
        </svg>
      </div>

      <h1 className="mb-3 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        Meet <span className="text-sandra-600">Sandra</span>
      </h1>
      <p className="mb-2 text-lg text-gray-500 sm:text-xl">
        The AI assistant for the EdLight ecosystem
      </p>
      <p className="mb-8 max-w-lg text-sm text-gray-400">
        Sandra helps you navigate EdLight platforms, find documentation, and get answers in
        English, French, and Haitian Creole.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/chat"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-sandra-600 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-sandra-700 hover:shadow-xl"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
          Start Chatting
        </Link>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-8 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50"
        >
          Admin Panel
        </Link>
      </div>

      {/* Platform cards */}
      <div className="mt-16 grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { name: 'EdLight Code', desc: 'Core platform' },
          { name: 'EdLight Academy', desc: 'Learning resources' },
          { name: 'EdLight News', desc: 'Community updates' },
          { name: 'EdLight Initiative', desc: 'Organization hub' },
        ].map((platform) => (
          <div
            key={platform.name}
            className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm"
          >
            <p className="text-sm font-semibold text-gray-900">{platform.name}</p>
            <p className="text-xs text-gray-500">{platform.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="mt-16 text-xs text-gray-400">
        Sandra supports 🇺🇸 English · 🇫🇷 Français · 🇭🇹 Kreyòl Ayisyen
      </p>
    </div>
  );
}
