'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OracleOrb } from '@/components/ui/oracle-orb';

const SITE_NAME = 'Sandra';

const navLinks = [
  { href: '/chat', label: 'Chat' },
  { href: '/docs', label: 'Developers' },
  { href: '/admin', label: 'Admin' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="shrink-0 border-b border-outline-variant/10 bg-surface/60 px-8 py-3 backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        {/* Logo: mini orb + site name */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative flex h-7 w-7 items-center justify-center">
            <OracleOrb size={28} />
          </div>
          <span className="text-lg font-black tracking-tighter text-primary transition-colors group-hover:text-white">
            {SITE_NAME}
          </span>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-8">
          {navLinks.map(({ href, label }) => {
            const active =
              href === '/chat' ? pathname.startsWith('/chat')
              : href === '/docs' ? pathname.startsWith('/docs')
              : href === '/admin' ? pathname.startsWith('/admin')
              : pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`text-[0.6875rem] font-medium uppercase tracking-[0.05em] transition-colors duration-300 ${
                  active
                    ? 'text-primary after:mx-auto after:block after:h-1 after:w-1 after:rounded-full after:bg-primary after:content-[""]'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                {label}
              </Link>
            );
          })}
          <span className="material-symbols-outlined cursor-pointer text-2xl text-on-surface-variant transition-colors hover:text-primary">
            account_circle
          </span>
        </div>
      </div>
    </header>
  );
}
