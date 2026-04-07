'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { OracleOrb } from '@/components/ui/oracle-orb';

const SITE_NAME = 'Sandra';

const navLinks = [
  { href: '/chat', label: 'Chat' },
  { href: '/docs', label: 'Developers' },
  { href: '/admin', label: 'Admin' },
];

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/chat') return pathname.startsWith('/chat');
    if (href === '/docs') return pathname.startsWith('/docs');
    if (href === '/admin') return pathname.startsWith('/admin');
    return pathname === href;
  };

  return (
    <header
      className="shrink-0 border-b border-outline-variant/10 bg-surface/60 px-4 py-2.5 backdrop-blur-2xl sm:px-8 sm:py-3"
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
          <span className="material-symbols-outlined cursor-pointer text-2xl text-on-surface-variant transition-colors hover:text-primary">
            account_circle
          </span>
        </div>

        {/* Mobile: account + hamburger */}
        <div className="flex items-center gap-1 sm:hidden">
          <span className="material-symbols-outlined cursor-pointer p-1 text-2xl text-on-surface-variant">
            account_circle
          </span>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant active:bg-surface-container"
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <nav className="mt-2.5 flex flex-col gap-1 border-t border-outline-variant/10 pt-2 sm:hidden">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-on-surface-variant active:bg-surface-container'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
