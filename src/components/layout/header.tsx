'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';

import { OracleOrb } from '@/components/ui/oracle-orb';

const SITE_NAME = 'Sandra';

const navLinks = [
  { href: '/chat', label: 'Chat' },
  { href: '/docs', label: 'Developers' },
  { href: '/admin', label: 'Admin' },
];

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isChat = pathname.startsWith('/chat');
  const isActive = (href: string) => {
    if (href === '/chat') return pathname.startsWith('/chat');
    if (href === '/docs') return pathname.startsWith('/docs');
    if (href === '/admin') return pathname.startsWith('/admin');
    return pathname === href;
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [menuOpen]);

  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  return (
    <header
      className={`shrink-0 border-b border-outline-variant/10 bg-surface/60 px-4 py-2.5 backdrop-blur-2xl sm:px-8 sm:py-3 ${isChat ? 'hidden sm:block' : ''}`}
      style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
    >
      <div className="flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <div className="relative flex h-6 w-6 shrink-0 items-center justify-center sm:h-7 sm:w-7">
            <OracleOrb size={24} />
          </div>
          <span className="text-base font-black tracking-tighter text-primary transition-colors group-hover:text-white sm:text-lg">
            {SITE_NAME}
          </span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-6 sm:flex">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-[0.6875rem] font-medium uppercase tracking-[0.05em] transition-colors duration-300 ${
                isActive(href)
                  ? 'text-primary after:mx-auto after:block after:h-1 after:w-1 after:rounded-full after:bg-primary after:content-[""]'
                  : 'text-on-surface-variant hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}

          {/* Account area */}
          {isLoading ? (
            <span className="material-symbols-outlined animate-pulse text-2xl text-on-surface-variant">
              account_circle
            </span>
          ) : isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 rounded-full border border-outline-variant/20 px-2 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:border-outline-variant/40 hover:text-white"
              >
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-5 w-5 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="material-symbols-outlined text-lg">account_circle</span>
                )}
                <span className="max-w-[120px] truncate">
                  {session?.user?.name ?? session?.user?.email ?? 'User'}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-outline-variant/15 bg-surface-container-high/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
                  <div className="border-b border-outline-variant/10 px-3 py-2.5">
                    <p className="text-sm font-medium text-white truncate">
                      {session?.user?.name ?? 'Signed in'}
                    </p>
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {session?.user?.email ?? ''}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-primary/60">
                      {session?.user?.role ?? 'student'}
                    </p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/chat"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="material-symbols-outlined text-lg">chat</span>
                      Chat
                    </Link>
                    {session?.user?.role === 'admin' && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-white"
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                        Admin
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut({ callbackUrl: '/' });
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-950/30"
                    >
                      <span className="material-symbols-outlined text-lg">logout</span>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => signIn(undefined, { callbackUrl: '/chat' })}
              className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-all hover:border-primary/50 hover:bg-primary/20"
            >
              <span className="material-symbols-outlined text-base">login</span>
              Sign in
            </button>
          )}
        </div>

        {/* Mobile: account icon only (nav handled by bottom bar) */}
        {isLoading ? (
          <span className="material-symbols-outlined animate-pulse p-1 text-2xl text-on-surface-variant sm:hidden">
            account_circle
          </span>
        ) : isAuthenticated ? (
          <Link
            href="/chat"
            className="material-symbols-outlined p-1 text-2xl text-primary transition-colors hover:text-white sm:hidden"
          >
            account_circle
          </Link>
        ) : (
          <button
            onClick={() => signIn(undefined, { callbackUrl: '/chat' })}
            className="material-symbols-outlined p-1 text-2xl text-primary transition-colors hover:text-white sm:hidden"
          >
            login
          </button>
        )}
      </div>
    </header>
  );
}
