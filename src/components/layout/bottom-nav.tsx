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
      className="sm:hidden fixed bottom-2 left-3 right-3 z-50 flex items-stretch rounded-2xl border border-outline-variant/20 bg-surface-container-low/85 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`group relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium tracking-wide transition-colors duration-200 touch-manipulation ${
              active ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            {/* Active pill indicator */}
            {active && (
              <>
                <span className="absolute inset-x-1 top-1 bottom-1 rounded-xl bg-primary/10" />
                <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
              </>
            )}
            {/* Icon */}
            <span
              className={`material-symbols-outlined relative z-10 text-[22px] transition-all duration-200 ${
                active ? 'scale-110' : 'group-active:scale-90'
              }`}
              style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
            >
              {icon}
            </span>
            <span className="relative z-10">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
