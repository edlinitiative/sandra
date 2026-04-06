import Link from 'next/link';

const cards = [
  {
    href: '/docs/quickstart',
    icon: 'trending_up',
    title: 'Quickstart',
    description: 'Send your first message to Sandra in under 5 minutes — just plain HTTP.',
    label: 'Start here',
  },
  {
    href: '/docs/api-reference',
    icon: 'code',
    title: 'API Reference',
    description: 'Complete reference for every endpoint — chat, stream, voice, webhooks, admin.',
    label: 'View reference',
  },
  {
    href: '/docs/channels',
    icon: 'forum',
    title: 'Channels',
    description: 'Connect WhatsApp, Instagram, email, and voice — all self-service.',
    label: 'Setup channels',
  },
  {
    href: '/docs/knowledge-base',
    icon: 'menu_book',
    title: 'Knowledge Base',
    description: 'Index your own content so Sandra answers questions about your platform.',
    label: 'Add your docs',
  },
  {
    href: '/docs/multi-tenant',
    icon: 'dns',
    title: 'Multi-Tenant',
    description: 'Isolate data, tools, and credentials per customer. Full white-label support.',
    label: 'Set up tenants',
  },
  {
    href: '/docs/admin',
    icon: 'admin_panel_settings',
    title: 'Admin Guides',
    description: 'Connect Google Workspace, Zoom, WhatsApp, Instagram, GitHub, and more from the Admin Portal.',
    label: 'Setup integrations',
  },
];

export default function DocsPage() {
  return (
    <div>
      <div className="mb-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Open Platform &middot; Self-Hostable
        </div>
        <h1 className="mb-4 text-4xl font-black tracking-tighter text-on-surface">
          Developer Docs
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-on-surface-variant">
          Sandra is an open, self-hostable AI agent platform. Deploy your own instance, connect
          any channel, index your own content, and white-label it for your customers.
        </p>
      </div>

      <section className="mb-10 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          What you can build
        </h2>
        <ul className="space-y-3">
          {[
            'A chat widget on your website backed by Sandra\u2019s full agent loop — deploy on your own domain',
            'WhatsApp or Instagram automation that handles support, enrollment, or scheduling',
            'A real-time voice assistant via WebRTC or a REST-based voice round-trip',
            'An AI layer over your own documentation — index any GitHub repo, get grounded answers',
            'A fully isolated white-label AI assistant for each of your customers (multi-tenant)',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5 text-base text-primary">
                check_circle
              </span>
              <span className="text-sm leading-relaxed text-on-surface/80">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          Base URL
        </h2>
        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 font-mono text-sm text-primary">
          https://&lt;your-sandra-instance&gt;
        </div>
        <p className="mt-2 text-xs text-outline">
          All endpoints are relative to wherever you deploy Sandra. Chat and voice endpoints require
          no authentication. Admin endpoints require an{' '}
          <code className="text-on-surface-variant">x-api-key</code> header that you generate from
          the admin dashboard.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6 transition-colors hover:border-primary/30 hover:bg-surface-container"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <span className="material-symbols-outlined text-xl text-primary">{card.icon}</span>
            </div>
            <div>
              <h3 className="mb-1 font-bold text-on-surface">{card.title}</h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">{card.description}</p>
            </div>
            <span className="mt-auto flex items-center gap-1 text-xs font-medium text-primary transition-transform group-hover:translate-x-0.5">
              {card.label}
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
