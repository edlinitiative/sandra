import Link from 'next/link';
import { APP_NAME } from '@/lib/config/constants';
import { OracleOrb } from '@/components/ui/oracle-orb';
import { GlitchText } from '@/components/ui/glitch-text';

export default function HomePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center overflow-hidden px-6 pb-32 pt-24 text-center">
        {/* Nebula background layers */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-nebula-drift absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[130px]" />
          <div
            className="animate-nebula-drift absolute -right-20 top-20 h-[400px] w-[400px] rounded-full bg-[rgba(100,60,255,0.06)] blur-[120px]"
            style={{ animationDelay: '-4s' }}
          />
          <div
            className="animate-nebula-drift absolute bottom-0 left-1/4 h-[350px] w-[600px] rounded-full bg-primary/[0.04] blur-[150px]"
            style={{ animationDelay: '-8s' }}
          />
        </div>

        {/* Oracle Orb */}
        <div className="animate-orb-float relative mb-8">
          {/* Outer ring pulse */}
          <div className="absolute inset-0 -m-4 rounded-full border border-primary/10 animate-oracle-breathe" />
          <div
            className="absolute inset-0 -m-8 rounded-full border border-primary/5 animate-oracle-breathe"
            style={{ animationDelay: '-2s' }}
          />
          <OracleOrb size={240} />
        </div>

        {/* Headline */}
        <h1 className="relative mb-6 text-6xl font-black tracking-tighter md:text-8xl">
          <span className="bg-gradient-to-b from-white via-white/90 to-primary/60 bg-clip-text text-transparent">
            Meet{' '}
          </span>
          <GlitchText
            text={APP_NAME}
            className="bg-gradient-to-r from-primary via-white to-primary bg-clip-text text-transparent"
          />
        </h1>

        {/* Subheading */}
        <p className="mb-12 max-w-2xl text-lg leading-relaxed text-on-surface-variant/80 md:text-xl">
          An oracle of intelligence — multi-channel AI that sees, speaks, and knows.
        </p>

        {/* CTAs */}
        <div className="relative flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/chat"
            className="group relative inline-flex items-center justify-center gap-2.5 rounded-full bg-primary/90 px-10 py-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(174,198,255,0.25)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(174,198,255,0.4)] active:scale-95"
          >
            <span className="relative z-10">Enter the oracle</span>
            <span className="material-symbols-outlined relative z-10 text-lg transition-transform group-hover:translate-x-0.5">
              arrow_forward
            </span>
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant/20 bg-white/[0.03] px-10 py-4 text-sm font-medium text-on-surface-variant backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-white/[0.06] hover:text-white active:scale-95"
          >
            Admin Panel
          </Link>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-32">
        <div className="mb-12 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
            Capabilities
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            One platform, every channel
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              icon: 'forum',
              title: 'Multi-Channel',
              desc: 'WhatsApp, Instagram, email, voice, and web — all from a single platform.',
              glow: 'from-primary/40 to-transparent',
            },
            {
              icon: 'neurology',
              title: 'Knowledge Base',
              desc: 'Index repos, docs, and websites. Search everything with AI-powered retrieval.',
              glow: 'from-[rgba(100,200,255,0.4)] to-transparent',
            },
            {
              icon: 'hub',
              title: 'Multi-Tenant',
              desc: 'Per-tenant config, branding, and credentials. Deploy once, serve many.',
              glow: 'from-[rgba(160,140,255,0.4)] to-transparent',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="group relative overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low/50 p-8 backdrop-blur-sm transition-all hover:border-outline-variant/20 hover:bg-surface-container/50"
            >
              {/* Top glow line */}
              <div
                className={`absolute left-0 right-0 top-0 h-px bg-gradient-to-r ${card.glow}`}
              />
              <span
                className="material-symbols-outlined mb-4 text-3xl text-primary/80"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {card.icon}
              </span>
              <h3 className="mb-2 text-lg font-bold text-on-surface">{card.title}</h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">{card.desc}</p>
            </div>
          ))}
        </div>

        {/* Developer CTA */}
        <div className="mt-4">
          <Link
            href="/docs"
            className="group block overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.03] p-8 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-primary/[0.06]"
          >
            <div className="flex flex-col gap-8 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  For Developers
                </div>
                <h3 className="mb-2 text-2xl font-bold text-on-surface">
                  Integrate {APP_NAME} into your platform
                </h3>
                <p className="max-w-xl leading-relaxed text-on-surface-variant">
                  Chat API, streaming, WhatsApp, Instagram, voice, knowledge base indexing, and
                  multi-tenant support.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Chat API', 'Streaming SSE', 'WhatsApp', 'Voice', 'Knowledge Base', 'Multi-Tenant'].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-outline-variant/10 bg-surface-container-high/50 px-2.5 py-1 text-xs text-on-surface-variant"
                      >
                        {tag}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 font-medium text-primary transition-transform group-hover:translate-x-1 md:shrink-0">
                <span>View docs</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="flex w-full flex-col items-center justify-between border-t border-outline-variant/10 bg-surface-container-lowest px-12 py-12 md:flex-row">
        <p className="mb-6 text-sm text-on-surface-variant/60 md:mb-0">
          &copy; {new Date().getFullYear()} {APP_NAME}
        </p>
        <div className="flex gap-8">
          <span className="text-sm font-bold text-primary/80">English</span>
          <span className="cursor-pointer text-sm text-on-surface-variant/40 transition-all hover:text-primary">
            Fran&ccedil;ais
          </span>
          <span className="cursor-pointer text-sm text-on-surface-variant/40 transition-all hover:text-primary">
            Krey&ograve;l Ayisyen
          </span>
        </div>
      </footer>
    </div>
  );
}
