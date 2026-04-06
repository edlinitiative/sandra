'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/integrations', label: 'Integrations', icon: 'hub' },
  { href: '/admin/settings', label: 'Settings', icon: 'tune' },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 border-b border-outline-variant/15 px-6 pt-4 pb-3">
      {links.map(({ href, label, icon }) => {
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              active
                ? 'bg-surface-container-high text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
