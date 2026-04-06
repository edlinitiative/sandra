import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Agent Settings — Sandra Admin Guides',
  description:
    'Customize Sandra\u2019s name, personality, system prompt, supported languages, and topic guardrails.',
};

export default function AgentSettingsPage() {
  return (
    <div className="prose-custom">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/docs/admin"
          className="mb-3 inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Admin Guides
        </Link>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Agent Settings</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Customize Sandra&rsquo;s identity, personality, language support, and topic guardrails
          from the Admin Portal → <strong>Settings</strong> tab.
        </p>
      </div>

      {/* Identity */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">
          <span className="material-symbols-outlined mr-1 align-middle text-base text-primary">
            badge
          </span>
          Identity &amp; branding
        </h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Field
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Description
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Example
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['Agent Name', 'How Sandra introduces herself', 'Sandra, Aria, Support Bot'],
                ['Organization Name', 'Your company / org name', 'Acme Corp'],
                ['Organization Description', 'Brief org description', 'A SaaS platform for project management'],
                ['Website URL', 'Your website', 'https://acme.com'],
                ['Contact Email', 'Support / contact email', 'support@acme.com'],
              ].map(([field, desc, example]) => (
                <tr key={field}>
                  <td className="px-4 py-2.5 font-medium text-on-surface">{field}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{desc}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-on-surface-variant">{example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* System prompt */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">
          <span className="material-symbols-outlined mr-1 align-middle text-base text-primary">
            psychology
          </span>
          System prompt
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
          The system prompt defines Sandra&rsquo;s core personality and instructions. Two options:
        </p>

        <div className="mb-4 rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
          <h3 className="mb-2 text-sm font-bold text-on-surface">System Prompt Override</h3>
          <p className="mb-2 text-xs text-on-surface-variant">
            Replace Sandra&rsquo;s default prompt entirely. Use when you need full control.
          </p>
          <div className="rounded-lg bg-black/30 p-3 font-mono text-xs leading-relaxed text-on-surface/70">
            You are Sandra, an AI assistant for Acme Corp. Help team members with scheduling, email,
            and project management. Always be professional but friendly.
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
          <h3 className="mb-2 text-sm font-bold text-on-surface">Additional Context</h3>
          <p className="mb-2 text-xs text-on-surface-variant">
            Add extra instructions <em>on top of</em> the default prompt. Best for facts and guidelines.
          </p>
          <div className="rounded-lg bg-black/30 p-3 font-mono text-xs leading-relaxed text-on-surface/70">
            - Our fiscal year starts in April{'\n'}
            - The CEO is Jane Smith (jane@acme.com){'\n'}
            - Team standup is every day at 9am EST{'\n'}
            - Use metric units for all measurements
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm leading-relaxed text-on-surface">
          <strong>Tip:</strong> Use &ldquo;Additional Context&rdquo; for facts and guidelines. Use
          &ldquo;System Prompt Override&rdquo; only if you need to completely change Sandra&rsquo;s
          personality.
        </div>
      </section>

      {/* Languages */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">
          <span className="material-symbols-outlined mr-1 align-middle text-base text-primary">
            translate
          </span>
          Language support
        </h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Add language codes for languages your team uses. Sandra auto-detects the incoming language
          and responds in the same language if it&rsquo;s in the supported list.
        </p>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['en', 'English'],
                ['fr', 'French'],
                ['es', 'Spanish'],
                ['ar', 'Arabic'],
                ['ht', 'Haitian Creole'],
                ['pt', 'Portuguese'],
                ['zh', 'Chinese'],
              ].map(([code, lang]) => (
                <tr key={code}>
                  <td className="px-4 py-2 font-mono text-xs text-primary">{code}</td>
                  <td className="px-4 py-2 text-xs text-on-surface-variant">{lang}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-outline">
          Default: English if no languages are configured.
        </p>
      </section>

      {/* Topic guardrails */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">
          <span className="material-symbols-outlined mr-1 align-middle text-base text-primary">
            shield
          </span>
          Topic guardrails
        </h2>

        <div className="mb-4 rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
          <h3 className="mb-2 text-sm font-bold text-on-surface">Allowed Topics</h3>
          <p className="mb-2 text-xs text-on-surface-variant">
            Define what Sandra should engage with. Leave empty for no restrictions.
          </p>
          <div className="rounded-lg bg-black/30 p-3 font-mono text-xs leading-relaxed text-on-surface/70">
            Company policies, meeting scheduling, email management,{'\n'}
            project status, HR questions, IT support
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
          <h3 className="mb-2 text-sm font-bold text-on-surface">Off-Topic Response</h3>
          <p className="mb-2 text-xs text-on-surface-variant">
            How Sandra responds when asked about topics outside the allowed list.
          </p>
          <div className="rounded-lg bg-black/30 p-3 font-mono text-xs leading-relaxed text-on-surface/70">
            I appreciate the question, but I&rsquo;m specifically designed to help with
            work-related tasks. Is there anything work-related I can help you with?
          </div>
        </div>
      </section>

      {/* Configuration examples */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          Configuration examples
        </h2>
        <div className="space-y-4">
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
            <h3 className="mb-2 text-sm font-bold text-on-surface">Customer Support Bot</h3>
            <div className="rounded-lg bg-black/30 p-3 font-mono text-xs leading-relaxed text-on-surface/70">
              <div><span className="text-primary">Agent Name:</span> Support Assistant</div>
              <div><span className="text-primary">Allowed Topics:</span> Product support, Billing, Account management</div>
              <div><span className="text-primary">Off-Topic Response:</span> I&rsquo;m here to help with Acme support. Visit acme.com/contact for other questions.</div>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
            <h3 className="mb-2 text-sm font-bold text-on-surface">Internal Team Assistant</h3>
            <div className="rounded-lg bg-black/30 p-3 font-mono text-xs leading-relaxed text-on-surface/70">
              <div><span className="text-primary">Agent Name:</span> Sandra</div>
              <div><span className="text-primary">Additional Context:</span> Tech stack: Next.js, PostgreSQL, AWS. Sprint planning Monday 10am.</div>
              <div><span className="text-primary">Languages:</span> en, fr</div>
              <div><span className="text-primary">Allowed Topics:</span> (none — unrestricted)</div>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
            <h3 className="mb-2 text-sm font-bold text-on-surface">Multilingual Org</h3>
            <div className="rounded-lg bg-black/30 p-3 font-mono text-xs leading-relaxed text-on-surface/70">
              <div><span className="text-primary">Agent Name:</span> Sandra</div>
              <div><span className="text-primary">Languages:</span> en, fr, ht, es</div>
              <div><span className="text-primary">Additional Context:</span> EdLight operates in education tech. Offices: Port-au-Prince, New York, Paris.</div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Provider Configuration */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">
          <span className="material-symbols-outlined mr-1 align-middle text-base text-primary">
            swap_horiz
          </span>
          AI provider configuration
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
          Sandra supports <strong className="text-on-surface">multi-provider fallback</strong> for
          both chat and voice. If the primary provider is unavailable (quota exceeded, rate limited,
          server error), Sandra automatically retries with the next configured provider.
        </p>

        <h3 className="mb-3 text-sm font-bold text-on-surface">Chat providers</h3>
        <div className="mb-5 overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Priority</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Provider</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Model</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Env Var</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['1', 'OpenAI', 'gpt-4o', 'OPENAI_API_KEY'],
                ['2', 'Google Gemini', 'gemini-2.0-flash', 'GEMINI_API_KEY'],
                ['3', 'Anthropic', 'claude-3-5-sonnet', 'ANTHROPIC_API_KEY'],
              ].map(([pri, name, model, env]) => (
                <tr key={name}>
                  <td className="px-4 py-2.5 text-on-surface">{pri}</td>
                  <td className="px-4 py-2.5 font-medium text-on-surface">{name}</td>
                  <td className="px-4 py-2.5"><code className="text-xs text-primary">{model}</code></td>
                  <td className="px-4 py-2.5"><code className="text-xs text-on-surface-variant">{env}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mb-3 text-sm font-bold text-on-surface">Voice providers (STT &amp; TTS)</h3>
        <div className="mb-5 overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Priority</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Provider</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">STT</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">TTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['1', 'OpenAI', 'Whisper', 'tts-1'],
                ['2', 'Google Gemini', 'Multimodal STT', 'gemini-2.5-flash-preview-tts'],
              ].map(([pri, name, stt, tts]) => (
                <tr key={name}>
                  <td className="px-4 py-2.5 text-on-surface">{pri}</td>
                  <td className="px-4 py-2.5 font-medium text-on-surface">{name}</td>
                  <td className="px-4 py-2.5"><code className="text-xs text-primary">{stt}</code></td>
                  <td className="px-4 py-2.5"><code className="text-xs text-primary">{tts}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
          <p className="text-sm text-on-surface-variant">
            <span className="material-symbols-outlined mr-1 align-middle text-base text-primary">info</span>
            Only providers with a valid API key are included in the fallback chain. Set{' '}
            <code className="text-xs text-primary">AI_PROVIDER_PRIORITY</code> to change the
            priority order (e.g. <code className="text-xs text-on-surface-variant">gemini,openai,anthropic</code>).
          </p>
        </div>
      </section>

      {/* Best practices */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          Best practices
        </h2>
        <ul className="space-y-2">
          {[
            ['Keep the system prompt focused', 'Don\u2019t overload with too many instructions. Clear and concise works best.'],
            ['Use Additional Context for facts', 'Put team members, schedules, policies there \u2014 not in the system prompt.'],
            ['Test after changes', 'Settings take effect immediately. Try edge cases in the chat.'],
            ['Start permissive, then restrict', 'Begin without topic restrictions and add guardrails as patterns emerge.'],
            ['Review capability gaps', 'Check the Gaps tab \u2014 if Sandra gets off-topic requests, improve guardrails.'],
          ].map(([title, desc]) => (
            <li key={title} className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5 text-base text-primary">
                lightbulb
              </span>
              <div>
                <span className="text-sm font-medium text-on-surface">{title}</span>
                <span className="text-sm text-on-surface-variant"> — {desc}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Footer nav */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/admin/external-apis"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">&larr; External APIs</p>
          <p className="text-xs text-on-surface-variant">Connect any REST API.</p>
        </Link>
        <Link
          href="/docs/admin"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">All Admin Guides &rarr;</p>
          <p className="text-xs text-on-surface-variant">Back to the overview.</p>
        </Link>
      </section>
    </div>
  );
}
