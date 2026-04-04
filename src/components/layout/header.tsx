import Link from 'next/link';

export function Header() {
  return (
    <header className="glass shrink-0 border-b border-white/[0.06] px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          {/* Glowing orb logo */}
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sandra-500 to-sandra-700 glow-blue-sm transition-all duration-300 group-hover:glow-blue">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
              />
            </svg>
          </div>
          <div>
            <span className="block text-sm font-bold leading-tight text-white">Sandra</span>
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
