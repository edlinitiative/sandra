'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/admin/settings', label: 'Settings' },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-5xl gap-1 px-6 pt-6">
      {links.map(({ href, label }) => {
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-white/[0.1] text-white'
                : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
