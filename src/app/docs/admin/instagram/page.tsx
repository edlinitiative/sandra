import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Connect Instagram — Sandra Admin Guides',
  description: 'Respond to Instagram Direct Messages with AI-powered conversations.',
};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {n}
      </div>
      <div className="text-sm leading-relaxed text-on-surface-variant">{children}</div>
    </div>
  );
}

function CodeBlock({ code, lang = 'env' }: { code: string; lang?: string }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-outline-variant/15 bg-black/50">
      <div className="flex items-center gap-2 border-b border-outline-variant/15 px-4 py-2">
        <span className="text-[0.625rem] font-medium uppercase tracking-widest text-on-surface-variant">
          {lang}
        </span>
      </div>
      <pre className="p-4 text-sm leading-relaxed text-on-surface">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Callout({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warn' }) {
  const styles =
    type === 'warn'
      ? 'border-yellow-500/20 bg-yellow-500/[0.06]'
      : 'border-primary/20 bg-primary/[0.06]';
  return (
    <div className={`my-4 rounded-xl border px-4 py-3 text-sm leading-relaxed text-on-surface ${styles}`}>
      {children}
    </div>
  );
}

export default function InstagramPage() {
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
        <div className="mb-3 inline-flex ml-3 items-center gap-2 rounded-full border border-[#E1306C]/30 bg-[#E1306C]/10 px-3 py-1 text-xs font-medium text-[#E1306C]">
          ~20 min setup
        </div>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">
          Connect Instagram
        </h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Let users interact with Sandra through Instagram Direct Messages — text, images, and
          voice messages.
        </p>
      </div>

      {/* Capabilities */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          Capabilities
        </h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['DM conversations', 'Full AI conversations via Instagram Direct Messages'],
                ['Image understanding', 'Users send photos — Sandra analyzes them with vision AI'],
                ['Voice messages', 'Users send audio — Sandra transcribes and responds'],
                ['Identity linking', 'Link Instagram account to Sandra profile for personalization'],
              ].map(([cap, desc]) => (
                <tr key={cap}>
                  <td className="px-4 py-2.5 font-medium text-on-surface">{cap}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Callout>
        <strong>Prerequisites:</strong> An <strong>Instagram Business</strong> or{' '}
        <strong>Creator</strong> account (not personal), a Meta Business Account, and access to the{' '}
        <a
          href="https://developers.facebook.com"
          className="text-primary underline"
          target="_blank"
          rel="noopener"
        >
          Meta Developer Console
        </a>
        .
        {' '}If you already have a Meta App from WhatsApp setup, you can reuse it.
      </Callout>

      {/* Step 1 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">
          1. Convert to a business account (if needed)
        </h2>
        <div className="space-y-3">
          <Step n={1}>
            Open Instagram → <strong>Settings → Account</strong>
          </Step>
          <Step n={2}>
            Tap <strong>Switch to Professional Account</strong> → select <strong>Business</strong>
          </Step>
          <Step n={3}>Connect to your Facebook / Meta Business Page</Step>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">2. Set up the Meta app</h2>
        <div className="space-y-3">
          <Step n={1}>
            Create a Meta App (or reuse your WhatsApp app) at{' '}
            <a
              href="https://developers.facebook.com/apps"
              className="text-primary underline"
              target="_blank"
              rel="noopener"
            >
              developers.facebook.com/apps
            </a>
          </Step>
          <Step n={2}>
            From the app dashboard, click <strong>Add Product</strong> → find{' '}
            <strong>Instagram</strong> → <strong>Set Up</strong>
          </Step>
          <Step n={3}>Connect your Instagram Business Account when prompted</Step>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">3. Generate an access token</h2>
        <div className="space-y-3">
          <Step n={1}>
            Go to{' '}
            <a
              href="https://business.facebook.com/settings/system-users"
              className="text-primary underline"
              target="_blank"
              rel="noopener"
            >
              Business Settings → System Users
            </a>
          </Step>
          <Step n={2}>
            Create (or reuse) a system user → click <strong>Generate Token</strong>
          </Step>
          <Step n={3}>
            Add permissions:{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              instagram_basic
            </code>
            ,{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              instagram_manage_messages
            </code>
            ,{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              pages_messaging
            </code>
            ,{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              pages_manage_metadata
            </code>
          </Step>
          <Step n={4}>
            Click <strong>Generate Token</strong> and copy it
          </Step>
        </div>
      </section>

      {/* Step 4 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">4. Set up the webhook</h2>
        <div className="space-y-3">
          <Step n={1}>
            In your Meta app → <strong>Instagram → Webhooks</strong> →{' '}
            <strong>Edit Subscription</strong>
          </Step>
          <Step n={2}>
            <strong>Callback URL:</strong>{' '}
            <code className="mt-1 block rounded bg-white/[0.07] px-2 py-1 font-mono text-xs text-on-surface">
              https://{'<your-sandra-url>'}/api/channels/instagram
            </code>
          </Step>
          <Step n={3}>
            <strong>Verify Token:</strong> A secret string you choose
          </Step>
          <Step n={4}>
            Subscribe to{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">messages</code>{' '}
            and{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              messaging_postbacks
            </code>
          </Step>
        </div>
      </section>

      {/* Step 5 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">5. Configure Sandra</h2>

        <h3 className="mb-2 text-sm font-bold text-white">Option A: Environment variables</h3>
        <CodeBlock
          code={`INSTAGRAM_ACCESS_TOKEN=EAAxxxxxxx...
INSTAGRAM_VERIFY_TOKEN=sandra-ig-verify-2026
INSTAGRAM_APP_SECRET=abcdef123456...
INSTAGRAM_API_VERSION=v19.0`}
        />

        <h3 className="mb-2 mt-6 text-sm font-bold text-white">Option B: Admin Portal</h3>
        <div className="space-y-3">
          <Step n={1}>
            Admin Portal → <strong>Settings</strong> → <strong>Instagram Channel</strong>
          </Step>
          <Step n={2}>Enter Access Token, Verify Token, and App Secret</Step>
          <Step n={3}>
            Click <strong>Save</strong>
          </Step>
        </div>
      </section>

      {/* Step 6 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">6. Verify</h2>
        <div className="space-y-3">
          <Step n={1}>Send a DM to your Instagram Business account</Step>
          <Step n={2}>Sandra should respond within a few seconds</Step>
          <Step n={3}>Try text, a photo, or a voice message</Step>
        </div>
      </section>

      {/* App Review notice */}
      <Callout type="warn">
        <strong>App Review for production:</strong> For users outside your business, your Meta app
        needs App Review approval for{' '}
        <code className="rounded bg-white/[0.07] px-1 text-xs">instagram_manage_messages</code>.
        During development, test with accounts that have a role in your Meta app (Admin, Developer,
        Tester).
      </Callout>

      {/* Instagram-specific behavior */}
      <section className="mb-10 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6">
        <h2 className="mb-3 text-sm font-bold text-white">Instagram-specific behavior</h2>
        <ul className="space-y-1.5 text-xs leading-relaxed text-on-surface-variant">
          <li>
            • <strong className="text-on-surface">Formatting:</strong> Markdown is automatically
            stripped — Instagram DMs don&rsquo;t support rich text
          </li>
          <li>
            • <strong className="text-on-surface">Long messages:</strong> Automatically split into
            multiple messages to stay within character limits
          </li>
          <li>
            • <strong className="text-on-surface">Identity linking:</strong> Same flow as WhatsApp
            — email verification to link accounts across channels
          </li>
        </ul>
      </section>

      {/* Security */}
      <section className="mb-10 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6">
        <h2 className="mb-3 text-sm font-bold text-white">
          <span className="material-symbols-outlined mr-1 align-middle text-base text-primary">
            shield
          </span>
          Security notes
        </h2>
        <ul className="space-y-1.5 text-xs leading-relaxed text-on-surface-variant">
          <li>• Incoming webhooks verified with <strong className="text-on-surface">HMAC-SHA256</strong></li>
          <li>• Messages deduplicated to prevent double-processing</li>
          <li>• Messages processed serially per user to maintain conversation coherence</li>
          <li>• Audio transcribed in-memory — files not stored</li>
        </ul>
      </section>

      {/* Footer nav */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/admin/whatsapp"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">&larr; Connect WhatsApp</p>
          <p className="text-xs text-on-surface-variant">WhatsApp Business setup.</p>
        </Link>
        <Link
          href="/docs/admin/github"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Connect GitHub &rarr;</p>
          <p className="text-xs text-on-surface-variant">Repository knowledge indexing.</p>
        </Link>
      </section>
    </div>
  );
}
