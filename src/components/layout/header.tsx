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
            {/* Audio equalizer mark — represents Sandra as a voice AI */}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="1" y="11" width="4" height="11" rx="2" fill="white" fillOpacity="0.45" />
              <rect x="6.5" y="5" width="4" height="17" rx="2" fill="white" />
              <rect x="12" y="8" width="4" height="14" rx="2" fill="white" fillOpacity="0.8" />
              <rect x="17.5" y="13" width="4" height="9" rx="2" fill="white" fillOpacity="0.5" />
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
