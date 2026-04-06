import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center overflow-hidden px-6 pb-32 pt-20 text-center">
        {/* Background radial bloom */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />

        {/* Glowing AI orb */}
        <div className="ai-orb-glow relative mb-12 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-primary-container">
          <span
            className="material-symbols-outlined text-4xl text-on-primary-container"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            blur_on
          </span>
        </div>

        {/* Headline */}
        <h1 className="mb-6 bg-gradient-to-b from-white to-on-surface-variant bg-clip-text text-6xl font-black tracking-tighter text-transparent md:text-8xl">
          Meet Sandra
        </h1>

        {/* Subheading */}
        <p className="mb-12 max-w-2xl text-xl leading-relaxed text-on-surface-variant">
          The AI assistant for the EdLight ecosystem. Empowering educators with
          agentic intelligence and real-time insights.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2.5 rounded-full bg-on-primary-container px-10 py-4 text-sm font-bold text-surface-container-lowest shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95"
          >
            Talk to Sandra
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant/30 px-10 py-4 text-sm font-medium text-on-surface transition-all hover:bg-white/5 active:scale-95"
          >
            Admin Panel
          </Link>
        </div>
      </section>

      {/* ── Bento Grid ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-32">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {/* EdLight Code — wide */}
          <a
            href="https://code.edlight.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative col-span-1 cursor-pointer overflow-hidden rounded-3xl bg-surface-container-low p-8 transition-colors hover:bg-surface-container md:col-span-2"
          >
            <div className="relative z-10 flex h-full flex-col justify-between gap-12">
              <div>
                <span className="material-symbols-outlined mb-4 text-3xl text-primary">
                  terminal
                </span>
                <h3 className="mb-2 text-2xl font-bold text-on-surface">EdLight Code</h3>
                <p className="leading-relaxed text-on-surface-variant">
                  The core platform infrastructure designed for seamless scalability and
                  high-performance education tech.
                </p>
              </div>
              <div className="flex items-center gap-2 font-medium text-primary transition-transform group-hover:translate-x-2">
                <span>Launch Core</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </div>
            <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
              <span className="material-symbols-outlined text-[120px]">terminal</span>
            </div>
          </a>

          {/* EdLight Academy */}
          <a
            href="https://academy.edlight.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group cursor-pointer rounded-3xl bg-surface-container-low p-8 transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined mb-4 text-3xl text-primary">school</span>
            <h3 className="mb-2 text-xl font-bold text-on-surface">Academy</h3>
            <p className="mb-6 text-sm leading-relaxed text-on-surface-variant">
              Premium learning resources and teacher certification programs.
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant transition-all group-hover:bg-primary group-hover:text-on-primary">
              <span className="material-symbols-outlined text-sm">north_east</span>
            </div>
          </a>

          {/* EdLight News */}
          <a
            href="https://news.edlight.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group cursor-pointer rounded-3xl bg-surface-container-low p-8 transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined mb-4 text-3xl text-primary">newspaper</span>
            <h3 className="mb-2 text-xl font-bold text-on-surface">News</h3>
            <p className="mb-6 text-sm leading-relaxed text-on-surface-variant">
              Stay updated with the latest community shifts and tech breakthroughs.
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant transition-all group-hover:bg-primary group-hover:text-on-primary">
              <span className="material-symbols-outlined text-sm">north_east</span>
            </div>
          </a>

          {/* EdLight Initiative — full width */}
          <a
            href="https://www.edlight.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group col-span-1 cursor-pointer overflow-hidden rounded-3xl bg-surface-container-low p-8 transition-colors hover:bg-surface-container md:col-span-4"
          >
            <div className="flex flex-col gap-8 md:flex-row md:items-center">
              <div className="flex-1">
                <span className="material-symbols-outlined mb-4 text-3xl text-primary">hub</span>
                <h3 className="mb-2 text-2xl font-bold text-on-surface">EdLight Initiative</h3>
                <p className="max-w-xl leading-relaxed text-on-surface-variant">
                  Our organization hub connecting educators, developers, and visionaries globally
                  to redefine the future of education through collective intelligence.
                </p>
              </div>
              <div className="flex items-center gap-2 font-medium text-primary transition-transform group-hover:translate-x-2 md:shrink-0">
                <span>Explore Initiative</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </div>
          </a>

          {/* Developers CTA — full width accent */}
          <Link
            href="/docs"
            className="group col-span-1 cursor-pointer overflow-hidden rounded-3xl border border-primary/20 bg-primary/5 p-8 transition-colors hover:border-primary/40 hover:bg-primary/[0.07] md:col-span-4"
          >
            <div className="flex flex-col gap-8 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  For Developers
                </div>
                <h3 className="mb-2 text-2xl font-bold text-on-surface">
                  Integrate Sandra into your platform
                </h3>
                <p className="max-w-xl leading-relaxed text-on-surface-variant">
                  Chat API, streaming, WhatsApp, Instagram, voice, knowledge base indexing, and
                  multi-tenant support. Everything you need to embed Sandra in your product.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Chat API', 'Streaming SSE', 'WhatsApp', 'Voice (WebRTC)', 'Knowledge Base', 'Multi-Tenant'].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant"
                      >
                        {tag}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 font-medium text-primary transition-transform group-hover:translate-x-1 md:shrink-0">
                <span>View developer docs</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="flex w-full flex-col items-center justify-between border-t border-outline-variant/15 bg-surface-container-lowest px-12 py-12 md:flex-row">
        <p className="mb-6 text-sm text-on-surface-variant/80 md:mb-0">
          &copy; 2026 Sandra Agentic AI &middot; EdLight Initiative
        </p>
        <div className="flex gap-8">
          <span className="text-sm font-bold text-primary">English</span>
          <span className="cursor-pointer text-sm text-on-surface-variant/60 transition-all hover:text-primary">
            Fran&ccedil;ais
          </span>
          <span className="cursor-pointer text-sm text-on-surface-variant/60 transition-all hover:text-primary">
            Krey&ograve;l Ayisyen
          </span>
        </div>
      </footer>
    </div>
  );
}
