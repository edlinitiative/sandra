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
            <p className="mb-2 px-3 text-[0.625rem] font-semibold uppercase tracking-widest text-slate-600">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-sandra-500/10 font-medium text-sandra-400'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
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

        <div className="rounded-2xl border border-sandra-500/20 bg-sandra-500/[0.06] p-4">
          <p className="mb-1 text-xs font-semibold text-sandra-300">Need a tenant?</p>
          <p className="mb-3 text-xs leading-relaxed text-slate-400">
            Contact EdLight to provision a dedicated tenant for your platform.
          </p>
          <a
            href="mailto:hello@edlight.org"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-sandra-400 hover:text-sandra-300"
          >
            Get in touch
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      </nav>
    </aside>
  );
}
