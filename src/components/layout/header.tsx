'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="flex min-h-[2.75rem] items-center rounded-lg px-3 text-xs font-medium text-slate-500 transition-colors hover:text-white"
      >
        Sign in
      </Link>
    );
  }

  const { name, email, image } = session.user;
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : (email?.[0] ?? '?').toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.06]"
        aria-label="User menu"
      >
        {image ? (
          <Image
            src={image}
            alt={name ?? 'User avatar'}
            width={26}
            height={26}
            className="rounded-full"
          />
        ) : (
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-sandra-600 text-[10px] font-bold text-white">
            {initials}
          </span>
        )}
        <span className="max-w-[120px] truncate text-xs font-medium text-slate-300">
          {name ?? email}
        </span>
        <svg
          className={`h-3 w-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-white/[0.08] bg-[#161616] py-1 shadow-xl">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <p className="truncate text-xs font-medium text-white">{name}</p>
            <p className="truncate text-[11px] text-slate-500">{email}</p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: '/' });
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  return (
    <header className="shrink-0 border-b border-white/[0.06] bg-[#0d0d0d] px-4 py-2.5">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sandra-500 to-sandra-700">
            <svg className="h-4 w-4" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="4" fill="white" fillOpacity="0.9" />
              <circle cx="16" cy="16" r="8" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
              <circle cx="16" cy="16" r="12" stroke="white" strokeOpacity="0.15" strokeWidth="1" fill="none" strokeDasharray="4 6" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">Sandra</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/chat" className="flex min-h-[2.75rem] items-center rounded-lg px-3 text-xs font-medium text-slate-500 transition-colors hover:text-white">Chat</Link>
          <Link href="/admin" className="flex min-h-[2.75rem] items-center rounded-lg px-3 text-xs font-medium text-slate-500 transition-colors hover:text-white">Admin</Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
