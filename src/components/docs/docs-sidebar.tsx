'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  {
    label: 'Getting Started',
    items: [
      { href: '/docs', label: 'Overview' },
      { href: '/docs/quickstart', label: 'Quickstart' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { href: '/docs/api-reference', label: 'API Reference' },
      { href: '/docs/channels', label: 'Channels' },
      { href: '/docs/knowledge-base', label: 'Knowledge Base' },
      { href: '/docs/multi-tenant', label: 'Multi-Tenant' },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0">
      <nav className="sticky top-6 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-3 text-[0.625rem] font-bold uppercase tracking-widest text-outline">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center rounded-xl px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="mb-1 text-xs font-bold text-primary">Need a tenant?</p>
          <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
            Contact EdLight to provision a dedicated tenant for your platform.
          </p>
          <a
            href="mailto:hello@edlight.org"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-fixed"
          >
            Get in touch
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </a>
        </div>
      </nav>
    </aside>
  );
}
