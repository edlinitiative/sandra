import Link from 'next/link';

export default function DocsPage() {
  const cards = [
    {
      href: '/docs/quickstart',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 10.5 6.75 14.25 10.5l5.25-5.25M3.75 19.5h16.5" />
      ),
      title: 'Quickstart',
      description: 'Send your first message to Sandra in under 5 minutes using the Chat API.',
      label: 'Start here →',
    },
    {
      href: '/docs/api-reference',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
      ),
      title: 'API Reference',
      description: 'Complete reference for all Sandra endpoints — chat, stream, webhooks, voice, admin.',
      label: 'View reference →',
    },
    {
      href: '/docs/channels',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      ),
      title: 'Channels',
      description: 'Connect Sandra to WhatsApp, Instagram, email, and voice on your platform.',
      label: 'Setup channels →',
    },
    {
      href: '/docs/knowledge-base',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      ),
      title: 'Knowledge Base',
      description: 'Index your own content so Sandra can answer questions about your platform.',
      label: 'Add your docs →',
    },
    {
      href: '/docs/multi-tenant',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21 8.954 9.893l3.342 3.342L9.75 21M8.25 3.75H4.5A2.25 2.25 0 0 0 2.25 6v4.5m0 0 16.5-3M2.25 10.5 21 7.5m0 0v13.5M21 7.5H16.5A2.25 2.25 0 0 0 14.25 9.75V21" />
      ),
      title: 'Multi-Tenant',
      description: 'Isolate data, tools, and credentials per customer. Full white-label support.',
      label: 'Set up tenants →',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sandra-500/30 bg-sandra-500/10 px-3 py-1 text-xs font-medium text-sandra-400">
          <span className="h-1.5 w-1.5 rounded-full bg-sandra-400" />
          Sandra V5 · April 2026
        </div>
        <h1 className="mb-4 text-4xl font-black tracking-tighter text-white">
          Developer Docs
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-slate-400">
          Everything you need to integrate Sandra into your platform — from a simple chat widget
          to full multi-channel, multi-tenant AI agent deployment.
        </p>
      </div>

      {/* What you can build */}
      <section className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">What you can build</h2>
        <ul className="space-y-3">
          {[
            'A chat widget on your website backed by Sandra\'s full agent loop',
            'WhatsApp or Instagram automation that handles support, enrollment, or scheduling',
            'A voice assistant with Sandra\'s identity and tools via WebRTC or REST',
            'An AI layer over your own documentation — index your repos, get grounded answers',
            'A fully isolated white-label AI assistant for each of your customers',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-sandra-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span className="text-sm leading-relaxed text-slate-300">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Base URL */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">Base URL</h2>
        <div className="rounded-xl border border-white/[0.06] bg-black/40 px-4 py-3 font-mono text-sm text-sandra-300">
          https://sandra.edlight.org
        </div>
        <p className="mt-2 text-xs text-slate-500">
          All endpoints are relative to this base. No authentication is required for the chat and voice endpoints.
          Admin endpoints require an <code className="text-slate-300">x-api-key</code> header.
        </p>
      </section>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-sandra-500/30 hover:bg-sandra-500/[0.04]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sandra-500/10 text-sandra-400">
              <svg className="h-4.5 w-4.5 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                {card.icon}
              </svg>
            </div>
            <div>
              <h3 className="mb-1 font-semibold text-white">{card.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{card.description}</p>
            </div>
            <span className="mt-auto text-xs font-medium text-sandra-400 transition-transform group-hover:translate-x-0.5">
              {card.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
