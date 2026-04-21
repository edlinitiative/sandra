'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/chat', label: 'Chat', icon: 'chat_bubble' },
  { href: '/docs', label: 'Docs', icon: 'book_2' },
  { href: '/admin', label: 'Admin', icon: 'settings' },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-outline-variant/10 bg-surface/80 backdrop-blur-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`group relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium tracking-wide transition-colors duration-200 ${
              active ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            {/* Active pill indicator */}
            {active && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
            )}
            {/* Icon */}
            <span
              className={`material-symbols-outlined text-[22px] transition-all duration-200 ${
                active ? 'scale-110' : 'group-active:scale-90'
              }`}
              style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
            >
              {icon}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
