'use client';

import Link from 'next/link';
import { GlitchText } from '@/components/ui/glitch-text';

export function Header() {
  return (
    <header className="glass shrink-0 border-b border-white/[0.06] px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          {/* Glowing orb logo */}
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sandra-500 to-sandra-700 glow-blue-sm transition-all duration-300 group-hover:glow-blue">
            {/* Abstract neural-wave mark */}
            <svg className="h-5 w-5" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="4" fill="white" fillOpacity="0.9" />
              <circle cx="16" cy="16" r="8" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" fill="none" />
              <circle cx="16" cy="16" r="12" stroke="white" strokeOpacity="0.2" strokeWidth="1" fill="none" strokeDasharray="4 6" />
              <line x1="16" y1="2" x2="16" y2="8" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />
              <line x1="16" y1="24" x2="16" y2="30" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />
              <line x1="2" y1="16" x2="8" y2="16" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />
              <line x1="24" y1="16" x2="30" y2="16" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              {/* Online pulse LED */}
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sandra-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sandra-500" />
              </span>
              <GlitchText
                text="Sandra"
                className="block text-sm font-bold leading-tight text-white"
              />
            </div>
            <span className="hidden text-[10px] font-medium leading-tight text-sandra-400 sm:block">
              by EdLight
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-0.5">
          <Link
            href="/chat"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Chat
          </Link>
          <Link
            href="/admin"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
