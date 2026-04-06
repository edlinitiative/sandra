import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Connect WhatsApp — Sandra Admin Guides',
  description:
    'Let users interact with Sandra through WhatsApp Business — text, images, and voice notes.',
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

export default function WhatsAppPage() {
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
        <div className="mb-3 inline-flex ml-3 items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1 text-xs font-medium text-[#25D366]">
          ~30 min setup
        </div>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">
          Connect WhatsApp
        </h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Let users message Sandra on WhatsApp — text, images, and voice notes. Full AI
          conversations from their phone.
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
                ['Text conversations', 'Full AI conversations via WhatsApp messages'],
                ['Image understanding', 'Users send photos — Sandra uses vision AI to analyze them'],
                ['Voice notes', 'Users send voice messages — Sandra transcribes and responds'],
                ['Group chats', 'Sandra participates in groups when mentioned'],
                ['Identity linking', 'Link WhatsApp number to Sandra account for personalization'],
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
        <strong>Prerequisites:</strong> A{' '}
        <a href="https://business.facebook.com" className="text-primary underline" target="_blank" rel="noopener">
          Meta Business Account
        </a>
        , access to the{' '}
        <a href="https://developers.facebook.com" className="text-primary underline" target="_blank" rel="noopener">
          Meta Developer Console
        </a>
        , a phone number for Sandra, and Admin Portal access.
      </Callout>

      {/* Step 1 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">1. Create a Meta app</h2>
        <div className="space-y-3">
          <Step n={1}>
            Go to{' '}
            <a href="https://developers.facebook.com/apps" className="text-primary underline" target="_blank" rel="noopener">
              developers.facebook.com/apps
            </a>{' '}
            → <strong>Create App</strong>
          </Step>
          <Step n={2}>
            Select <strong>Business</strong> → name it{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">Sandra AI</code>{' '}
            → connect your Business Account
          </Step>
          <Step n={3}>
            From the app dashboard, click <strong>Add Product</strong> → find{' '}
            <strong>WhatsApp</strong> → <strong>Set Up</strong>
          </Step>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">2. Configure a phone number</h2>
        <div className="space-y-3">
          <Step n={1}>
            In the WhatsApp section → <strong>API Setup</strong> — you&rsquo;ll see a test phone
            number (works for dev)
          </Step>
          <Step n={2}>
            For production, click <strong>Add phone number</strong> and complete verification
          </Step>
          <Step n={3}>
            Note the <strong>Phone Number ID</strong> from the API Setup page
          </Step>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">3. Generate a permanent access token</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          The temporary token in API Setup expires in 24 hours. For production, create a{' '}
          <strong>System User Token</strong>:
        </p>
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
            Click <strong>Add</strong> → create a system user named{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">Sandra Bot</code>{' '}
            with <strong>Admin</strong> role
          </Step>
          <Step n={3}>
            Click <strong>Generate Token</strong> → select your app → add permissions:{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              whatsapp_business_messaging
            </code>
            ,{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              whatsapp_business_management
            </code>
          </Step>
          <Step n={4}>
            Click <strong>Generate Token</strong> and <strong>copy the token</strong>
          </Step>
        </div>
        <Callout type="warn">
          <strong>⚠️ Save this token securely!</strong> It won&rsquo;t be shown again.
        </Callout>
      </section>

      {/* Step 4 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">4. Set up the webhook</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Sandra receives incoming messages via a webhook from Meta.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            In your Meta app → <strong>WhatsApp → Configuration → Webhook</strong> → click{' '}
            <strong>Edit</strong>
          </Step>
          <Step n={2}>
            <strong>Callback URL:</strong>{' '}
            <code className="mt-1 block rounded bg-white/[0.07] px-2 py-1 font-mono text-xs text-on-surface">
              https://{'<your-sandra-url>'}/api/channels/whatsapp
            </code>
          </Step>
          <Step n={3}>
            <strong>Verify Token:</strong> A secret string you choose (e.g.{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              sandra-whatsapp-verify-2026
            </code>
            )
          </Step>
          <Step n={4}>
            Click <strong>Verify and Save</strong> → subscribe to the{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">messages</code>{' '}
            webhook field
          </Step>
        </div>
      </section>

      {/* Step 5 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">5. Configure Sandra</h2>

        <h3 className="mb-2 text-sm font-bold text-white">Option A: Environment variables</h3>
        <CodeBlock
          code={`WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx...
WHATSAPP_VERIFY_TOKEN=sandra-whatsapp-verify-2026
WHATSAPP_API_VERSION=v19.0`}
        />

        <h3 className="mb-2 mt-6 text-sm font-bold text-white">Option B: Admin Portal</h3>
        <div className="space-y-3">
          <Step n={1}>
            Admin Portal → <strong>Settings</strong> → <strong>WhatsApp Channel</strong>
          </Step>
          <Step n={2}>Enter Phone Number ID, Access Token, and Verify Token</Step>
          <Step n={3}>
            Click <strong>Save</strong>
          </Step>
        </div>
      </section>

      {/* Step 6 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">6. Verify</h2>
        <div className="space-y-3">
          <Step n={1}>Send a WhatsApp message to your Sandra phone number</Step>
          <Step n={2}>Sandra should respond within a few seconds</Step>
          <Step n={3}>
            Try: a text message, a photo (Sandra will describe it), or a voice note (Sandra will
            transcribe and respond)
          </Step>
        </div>
      </section>

      {/* Identity linking */}
      <section className="mb-10 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6">
        <h2 className="mb-3 text-sm font-bold text-white">
          <span className="material-symbols-outlined mr-1 align-middle text-base text-primary">
            link
          </span>
          Identity linking
        </h2>
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          Users can link their WhatsApp number to their Sandra account for personalized responses
          across all channels:
        </p>
        <ol className="space-y-1.5 text-xs leading-relaxed text-on-surface-variant">
          <li>1. User messages Sandra on WhatsApp</li>
          <li>2. Sandra offers to link their account</li>
          <li>3. User provides their email address</li>
          <li>4. Sandra sends a verification code to that email</li>
          <li>5. User confirms the code on WhatsApp → linked!</li>
        </ol>
      </section>

      {/* Troubleshooting */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Troubleshooting</h2>
        <div className="space-y-4">
          {[
            [
              'Messages not received',
              'Check that the webhook URL is correct, publicly accessible (HTTPS), and the "messages" field is subscribed.',
            ],
            [
              'Messages fail to send',
              'Check the access token. WhatsApp requires users to message first — Sandra can only reply within 24 hours of the last user message.',
            ],
            [
              'Slow responses',
              'WhatsApp messages go through Meta\u2019s servers — expect 2\u20135 second round-trips. Voice notes add 1\u20133 seconds for transcription.',
            ],
          ].map(([title, desc]) => (
            <div
              key={title}
              className="rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-3"
            >
              <p className="mb-1 text-sm font-semibold text-on-surface">{title}</p>
              <p className="text-xs leading-relaxed text-on-surface-variant">{desc}</p>
            </div>
          ))}
        </div>
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
          <li>• All webhook payloads verified with <strong className="text-on-surface">HMAC-SHA256</strong> signature validation</li>
          <li>• Message deduplication prevents double-processing</li>
          <li>• Access tokens encrypted at rest</li>
          <li>• Voice notes transcribed in-memory — audio files are not stored</li>
        </ul>
      </section>

      {/* Footer nav */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/admin/zoom"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">&larr; Connect Zoom</p>
          <p className="text-xs text-on-surface-variant">Meeting scheduling.</p>
        </Link>
        <Link
          href="/docs/admin/instagram"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Connect Instagram &rarr;</p>
          <p className="text-xs text-on-surface-variant">DM messaging channel.</p>
        </Link>
      </section>
    </div>
  );
}
