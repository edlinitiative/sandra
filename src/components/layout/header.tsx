'use client';

import Link from 'next/link';

export function Header() {
  return (
    <header className="shrink-0 border-b border-white/[0.05] bg-[#0d0d0d]/80 px-6 py-3.5 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sandra-500 to-sandra-700">
            <svg className="h-4 w-4" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="4" fill="white" fillOpacity="0.9" />
              <circle cx="16" cy="16" r="8" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
              <circle cx="16" cy="16" r="12" stroke="white" strokeOpacity="0.15" strokeWidth="1" fill="none" strokeDasharray="4 6" />
            </svg>
          </div>
          <span className="text-base font-black tracking-tighter text-sandra-400">Sandra</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/chat"
            className="flex min-h-[2.5rem] items-center rounded-lg px-4 text-[0.6875rem] font-medium uppercase tracking-widest text-slate-500 transition-colors hover:text-white"
          >
            Chat
          </Link>
          <Link
            href="/docs"
            className="flex min-h-[2.5rem] items-center rounded-lg px-4 text-[0.6875rem] font-medium uppercase tracking-widest text-slate-500 transition-colors hover:text-white"
          >
            Developers
          </Link>
          <Link
            href="/admin"
            className="flex min-h-[2.5rem] items-center rounded-lg px-4 text-[0.6875rem] font-medium uppercase tracking-widest text-slate-500 transition-colors hover:text-white"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
