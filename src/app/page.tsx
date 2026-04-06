import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex-1 overflow-y-auto">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center overflow-hidden px-6 pb-32 pt-20 text-center">

        {/* Background radial bloom */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sandra-500/[0.06] blur-[120px]" />

        {/* Glowing AI orb */}
        <div className="relative mb-12 flex h-24 w-24 animate-orb-float items-center justify-center rounded-full bg-gradient-to-tr from-sandra-600 to-sandra-400 ai-orb-glow">
          <svg className="h-10 w-10 text-white/90" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="4" fill="currentColor" />
            <circle cx="16" cy="16" r="8" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" fill="none" />
            <circle cx="16" cy="16" r="12" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" fill="none" strokeDasharray="4 6" />
          </svg>
        </div>

        {/* Headline */}
        <h1 className="mb-6 bg-gradient-to-b from-white via-white to-slate-500 bg-clip-text text-6xl font-black tracking-tighter text-transparent md:text-8xl">
          Meet Sandra
        </h1>

        {/* Subheading */}
        <p className="mb-12 max-w-2xl text-lg leading-relaxed text-slate-400 md:text-xl">
          The AI assistant for the EdLight ecosystem. Empowering educators
          with agentic intelligence and real-time insights.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-10 py-4 text-sm font-bold text-black shadow-[0_0_24px_rgba(255,255,255,0.12)] transition-all hover:scale-105 hover:bg-slate-100 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
            Talk to Sandra
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.12] px-10 py-4 text-sm font-medium text-slate-300 transition-all hover:border-white/[0.22] hover:bg-white/[0.04] active:scale-95"
          >
            Admin Panel
          </Link>
        </div>
      </section>

      {/* ── Bento Grid ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-32">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">

          {/* EdLight Code — wide */}
          <a
            href="https://code.edlight.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative col-span-1 cursor-pointer overflow-hidden rounded-3xl bg-white/[0.03] p-8 transition-colors hover:bg-white/[0.05] md:col-span-2"
          >
            <div className="relative z-10 flex h-full flex-col justify-between gap-12">
              <div>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sandra-500/10 text-sandra-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
                  </svg>
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white">EdLight Code</h3>
                <p className="leading-relaxed text-slate-400">
                  The core platform infrastructure designed for seamless scalability
                  and high-performance education tech.
                </p>
              </div>
              <div className="flex items-center gap-2 font-medium text-sandra-400 transition-transform group-hover:translate-x-1">
                <span>Launch Core</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
            {/* Ghost background icon */}
            <div className="pointer-events-none absolute right-4 top-4 opacity-[0.04] transition-opacity group-hover:opacity-[0.08]">
              <svg className="h-36 w-36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={0.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
              </svg>
            </div>
          </a>

          {/* EdLight Academy */}
          <a
            href="https://academy.edlight.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group cursor-pointer rounded-3xl bg-white/[0.03] p-8 transition-colors hover:bg-white/[0.05]"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sandra-500/10 text-sandra-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14 3 9l9-5 9 5-9 5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12v4c0 1 2.5 2 5 2s5-1 5-2v-4" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold text-white">Academy</h3>
            <p className="mb-6 text-sm leading-relaxed text-slate-400">
              Premium learning resources and teacher certification programs.
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] transition-all group-hover:border-sandra-400/50 group-hover:bg-sandra-500/10 group-hover:text-sandra-400">
              <svg className="h-3.5 w-3.5 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </a>

          {/* EdLight News */}
          <a
            href="https://news.edlight.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group cursor-pointer rounded-3xl bg-white/[0.03] p-8 transition-colors hover:bg-white/[0.05]"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sandra-500/10 text-sandra-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold text-white">News</h3>
            <p className="mb-6 text-sm leading-relaxed text-slate-400">
              Stay updated with the latest community shifts and tech breakthroughs.
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] transition-all group-hover:border-sandra-400/50 group-hover:bg-sandra-500/10 group-hover:text-sandra-400">
              <svg className="h-3.5 w-3.5 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </a>

          {/* EdLight Initiative — full width */}
          <a
            href="https://www.edlight.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group col-span-1 cursor-pointer overflow-hidden rounded-3xl bg-white/[0.03] p-8 transition-colors hover:bg-white/[0.05] md:col-span-4"
          >
            <div className="flex flex-col gap-8 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sandra-500/10 text-sandra-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3c2.7 2.5 4 5.5 4 9s-1.3 6.5-4 9c-2.7-2.5-4-5.5-4-9s1.3-6.5 4-9Z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white">EdLight Initiative</h3>
                <p className="max-w-xl leading-relaxed text-slate-400">
                  Our organization hub connecting educators, developers, and visionaries
                  globally to redefine the future of education through collective intelligence.
                </p>
              </div>
              <div className="flex items-center gap-2 font-medium text-sandra-400 transition-transform group-hover:translate-x-1 md:shrink-0">
                <span>Explore Initiative</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </a>

          {/* Developers — full width */}
          <Link
            href="/docs"
            className="group col-span-1 cursor-pointer overflow-hidden rounded-3xl border border-sandra-500/20 bg-sandra-500/[0.04] p-8 transition-colors hover:border-sandra-500/40 hover:bg-sandra-500/[0.07] md:col-span-4"
          >
            <div className="flex flex-col gap-8 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sandra-500/30 bg-sandra-500/10 px-3 py-1 text-xs font-medium text-sandra-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-sandra-400" />
                  For Developers
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white">Integrate Sandra into your platform</h3>
                <p className="max-w-xl leading-relaxed text-slate-400">
                  Chat API, streaming, WhatsApp, Instagram, voice, knowledge base indexing, and multi-tenant support.
                  Everything you need to embed Sandra in your product.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Chat API', 'Streaming SSE', 'WhatsApp', 'Voice (WebRTC)', 'Knowledge Base', 'Multi-Tenant'].map((tag) => (
                    <span key={tag} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 font-medium text-sandra-400 transition-transform group-hover:translate-x-1 md:shrink-0">
                <span>View developer docs</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </Link>

        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] bg-[#0a0a0a] px-8 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <p className="text-sm text-slate-600">
            © 2026 Sandra Agentic AI · EdLight Initiative
          </p>
          <div className="flex gap-6 text-sm">
            <span className="font-medium text-sandra-400">🇺🇸 English</span>
            <span className="cursor-pointer text-slate-500 transition-colors hover:text-sandra-400">🇫🇷 Français</span>
            <span className="cursor-pointer text-slate-500 transition-colors hover:text-sandra-400">🇭🇹 Kreyòl</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
