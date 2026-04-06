import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Admin Guides — Sandra Docs',
  description:
    'Step-by-step guides for connecting Sandra to Google Workspace, Zoom, WhatsApp, Instagram, GitHub, and more from the Admin Portal.',
};

const integrations = [
  {
    href: '/docs/admin/google-workspace',
    icon: 'mail',
    badge: 'Google',
    color: 'border-[#4285F4]/30 bg-[#4285F4]/10 text-[#4285F4]',
    title: 'Google Workspace',
    description:
      'Connect Gmail, Calendar, Drive, Tasks, Forms, and Contacts. The most essential integration.',
    time: '~20 min',
  },
  {
    href: '/docs/admin/zoom',
    icon: 'videocam',
    badge: 'Zoom',
    color: 'border-[#2D8CFF]/30 bg-[#2D8CFF]/10 text-[#2D8CFF]',
    title: 'Zoom',
    description: 'Schedule meetings, send invitations, and share join links automatically.',
    time: '~10 min',
  },
  {
    href: '/docs/admin/whatsapp',
    icon: 'chat',
    badge: 'WhatsApp',
    color: 'border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366]',
    title: 'WhatsApp Business',
    description:
      'Let users interact with Sandra via WhatsApp — text, images, and voice notes.',
    time: '~30 min',
  },
  {
    href: '/docs/admin/instagram',
    icon: 'photo_camera',
    badge: 'Instagram',
    color: 'border-[#E1306C]/30 bg-[#E1306C]/10 text-[#E1306C]',
    title: 'Instagram DMs',
    description: 'Respond to Instagram Direct Messages with AI-powered conversations.',
    time: '~20 min',
  },
  {
    href: '/docs/admin/github',
    icon: 'code',
    badge: 'GitHub',
    color: 'border-white/30 bg-white/10 text-white',
    title: 'GitHub',
    description: 'Index your repositories so Sandra can answer questions about your codebase.',
    time: '~5 min',
  },
  {
    href: '/docs/admin/external-apis',
    icon: 'extension',
    badge: 'Any API',
    color: 'border-tertiary/30 bg-tertiary/10 text-tertiary',
    title: 'External APIs',
    description: 'Connect any REST API with an OpenAPI spec — auto-generates tools for Sandra.',
    time: '~10 min',
  },
];

export default function AdminGuidesPage() {
  return (
    <div className="prose-custom">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
          Admin Portal
        </p>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Admin Guides</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Step-by-step guides for connecting Sandra to your organization&rsquo;s platforms.
          All setup is done from the{' '}
          <Link href="/admin" className="text-primary underline">
            Admin Portal
          </Link>{' '}
          &mdash; no coding required.
        </p>
      </div>

      {/* How it works */}
      <section className="mb-10 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6">
        <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          How Sandra integrations work
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
          Unlike consumer tools that ask each user to &ldquo;Sign in with Google,&rdquo; Sandra
          uses <strong className="text-on-surface">organization-level credentials</strong> &mdash;
          service accounts, server-to-server tokens, and API keys. This means:
        </p>
        <ul className="space-y-2">
          {[
            ['passkey', 'One-time setup — an admin connects each platform once for the whole org'],
            ['group', 'No per-user OAuth — team members don\u2019t need to individually authorize Sandra'],
            ['admin_panel_settings', 'Centralized control — manage all connections from a single dashboard'],
            ['lock', 'Secure credentials — all secrets are encrypted at rest and never exposed to end users'],
          ].map(([icon, text]) => (
            <li key={icon} className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5 text-base text-primary">
                {icon}
              </span>
              <span className="text-sm leading-relaxed text-on-surface/80">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Quick start checklist */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          Recommended setup order
        </h2>
        <ol className="space-y-2">
          {[
            'Log in to the Admin Portal (/admin)',
            'Connect Google Workspace — Gmail, Calendar, Drive',
            'Connect Zoom — meeting scheduling',
            'Connect messaging channels (WhatsApp, Instagram) if needed',
            'Connect GitHub if you want code knowledge',
            'Configure Agent Settings — name, personality, languages',
            'Add External APIs to extend capabilities',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[0.625rem] font-bold text-primary">
                {i + 1}
              </div>
              <span className="text-sm leading-relaxed text-on-surface-variant">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Integration cards */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          Platform integrations
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {integrations.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low p-5 transition-colors hover:border-primary/30 hover:bg-surface-container"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-widest ${item.color}`}
                >
                  {item.badge}
                </span>
                <span className="text-[0.625rem] text-outline">{item.time}</span>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-bold text-white group-hover:text-primary">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Settings card */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          Configuration
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/docs/admin/agent-settings"
            className="group flex items-start gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-low p-5 transition-colors hover:border-primary/30 hover:bg-surface-container"
          >
            <span className="material-symbols-outlined mt-0.5 text-xl text-primary">tune</span>
            <div>
              <h3 className="mb-1 text-sm font-bold text-white group-hover:text-primary">
                Agent Settings
              </h3>
              <p className="text-xs leading-relaxed text-on-surface-variant">
                Customize Sandra&rsquo;s name, personality, system prompt, supported languages,
                and topic guardrails.
              </p>
            </div>
          </Link>
          <div className="flex items-start gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
            <span className="material-symbols-outlined mt-0.5 text-xl text-primary">swap_horiz</span>
            <div>
              <h3 className="mb-1 text-sm font-bold text-white">
                AI Provider Fallback
              </h3>
              <p className="text-xs leading-relaxed text-on-surface-variant">
                Sandra supports <strong className="text-on-surface">3 chat providers</strong> (OpenAI → Gemini → Anthropic) and{' '}
                <strong className="text-on-surface">2 voice providers</strong> (OpenAI → Gemini) with automatic failover.
                Configure API keys and priority order in{' '}
                <Link href="/docs/admin/agent-settings" className="text-primary underline">Agent Settings</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Prerequisites */}
      <section className="rounded-xl border border-primary/20 bg-primary/[0.06] px-5 py-4">
        <h2 className="mb-2 text-xs font-bold text-primary">Before you start</h2>
        <ul className="space-y-1.5 text-sm text-on-surface-variant">
          <li className="flex items-start gap-2">
            <span className="material-symbols-outlined mt-0.5 text-sm text-primary">check_box_outline_blank</span>
            <strong className="text-on-surface">Admin access</strong> to Sandra (your account must
            have the <code className="rounded bg-white/[0.07] px-1 text-xs">admin</code> role)
          </li>
          <li className="flex items-start gap-2">
            <span className="material-symbols-outlined mt-0.5 text-sm text-primary">check_box_outline_blank</span>
            <strong className="text-on-surface">Admin access</strong> to the platforms you want to
            connect (Google Workspace, Zoom, Meta, etc.)
          </li>
        </ul>
      </section>
    </div>
  );
}
