import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Channels — Sandra Developer Docs',
  description: 'Connect WhatsApp, Instagram, email, and voice to your Sandra instance.',
};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{n}</div>
      <div className="text-sm leading-relaxed text-on-surface-variant">{children}</div>
    </div>
  );
}

function CodeBlock({ code, lang = 'env' }: { code: string; lang?: string }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-outline-variant/15 bg-black/50">
      <div className="flex items-center gap-2 border-b border-outline-variant/15 px-4 py-2">
        <span className="text-[0.625rem] font-medium uppercase tracking-widest text-on-surface-variant">{lang}</span>
      </div>
      <pre className="p-4 text-sm leading-relaxed text-on-surface">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ChannelBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full border px-3 py-0.5 text-[0.625rem] font-semibold uppercase tracking-widest ${color}`}>
      {children}
    </span>
  );
}

export default function ChannelsPage() {
  return (
    <div className="prose-custom">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Integrations</p>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Channels</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Sandra supports multiple messaging channels out of the box.
          Each channel is configured through environment variables on your deployment &mdash;
          no external service needs to provision anything for you.
        </p>
      </div>

      {/* WhatsApp */}
      <section className="mb-10">
        <ChannelBadge color="border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366]">WhatsApp</ChannelBadge>
        <h2 className="mt-3 mb-3 text-lg font-bold text-white">WhatsApp Business</h2>
        <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
          Sandra receives and replies to WhatsApp messages via the Meta Cloud API.
          You&rsquo;ll need a Meta Business account with a WhatsApp Business phone number.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            In the <a href="https://developers.facebook.com" className="text-primary underline" target="_blank" rel="noopener">Meta Developer Console</a>,
            create an app with the WhatsApp product. Note your <strong>Phone Number ID</strong> and generate a permanent <strong>Access Token</strong>.
          </Step>
          <Step n={2}>
            Set the webhook URL in Meta&rsquo;s console to:
            <code className="mt-1 block rounded bg-white/[0.07] px-2 py-1 font-mono text-xs text-on-surface">
              https://{'<your-sandra-url>'}/api/webhooks/whatsapp
            </code>
          </Step>
          <Step n={3}>
            Add these environment variables to your Sandra deployment:
          </Step>
        </div>
        <CodeBlock code={`WHATSAPP_VERIFY_TOKEN=any-secret-you-choose
WHATSAPP_ACCESS_TOKEN=your-meta-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id`} />
        <p className="text-xs text-outline">
          Sandra will automatically verify the webhook and start receiving messages.
          For multi-tenant setups, configure per-tenant WhatsApp credentials in the admin dashboard.
        </p>
      </section>

      {/* Instagram */}
      <section className="mb-10">
        <ChannelBadge color="border-[#E1306C]/30 bg-[#E1306C]/10 text-[#E1306C]">Instagram</ChannelBadge>
        <h2 className="mt-3 mb-3 text-lg font-bold text-white">Instagram DMs</h2>
        <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
          Sandra receives and replies to Instagram Direct Messages via the Meta Messenger Platform API.
          Requires a Facebook Page linked to an Instagram Professional account.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            In the Meta Developer Console, add the <strong>Instagram</strong> product to your app.
            Subscribe to the <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">messages</code> webhook field.
          </Step>
          <Step n={2}>
            Set the webhook URL to:
            <code className="mt-1 block rounded bg-white/[0.07] px-2 py-1 font-mono text-xs text-on-surface">
              https://{'<your-sandra-url>'}/api/webhooks/instagram
            </code>
          </Step>
          <Step n={3}>
            Add these environment variables:
          </Step>
        </div>
        <CodeBlock code={`INSTAGRAM_VERIFY_TOKEN=any-secret-you-choose
INSTAGRAM_ACCESS_TOKEN=your-page-access-token
INSTAGRAM_PAGE_ID=your-instagram-page-id`} />
      </section>

      {/* Email */}
      <section className="mb-10">
        <ChannelBadge color="border-primary/30 bg-primary/10 text-primary">Email</ChannelBadge>
        <h2 className="mt-3 mb-3 text-lg font-bold text-white">Email (Gmail / Google Workspace)</h2>
        <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
          Sandra can monitor a Gmail inbox and reply to emails automatically.
          Uses either Gmail push notifications or periodic polling via a cron.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Create a Google Cloud project with the Gmail API enabled.
            Set up a service account (or OAuth credentials) with domain-wide delegation if using Google Workspace.
          </Step>
          <Step n={2}>
            Add the Google credentials to your environment:
          </Step>
        </div>
        <CodeBlock code={`GOOGLE_SERVICE_ACCOUNT_EMAIL=sa@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
GOOGLE_DELEGATED_USER=inbox@yourdomain.com`} />
        <div className="mt-4 space-y-3">
          <Step n={3}>
            <strong>Option A — Push:</strong> Set up a Gmail push subscription that sends to{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">/api/webhooks/email</code>.
          </Step>
          <Step n={4}>
            <strong>Option B — Poll:</strong> Configure a cron job that hits{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">/api/cron/email-poll</code>{' '}
            every few minutes.
          </Step>
        </div>
      </section>

      {/* Voice */}
      <section className="mb-10">
        <ChannelBadge color="border-tertiary/30 bg-tertiary/10 text-tertiary">Voice</ChannelBadge>
        <h2 className="mt-3 mb-3 text-lg font-bold text-white">Voice (WebSocket)</h2>
        <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
          Real-time voice conversations using a WebSocket connection. The voice bridge handles
          speech-to-text (Deepgram), agent processing, and text-to-speech (Google Cloud TTS) in a
          single streaming connection.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Deploy the <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">voice-bridge/</code> service
            alongside your Sandra instance. It&rsquo;s a standalone Node.js process.
          </Step>
          <Step n={2}>
            Configure the voice bridge environment:
          </Step>
        </div>
        <CodeBlock code={`DEEPGRAM_API_KEY=your-deepgram-key
GOOGLE_TTS_API_KEY=your-google-tts-key   # or use the service account
SANDRA_API_URL=http://localhost:3000      # points at your Sandra instance
VOICE_PORT=8080`} />
        <div className="mt-4 space-y-3">
          <Step n={3}>
            The built-in chat UI connects to the voice bridge automatically when the mic button is pressed.
            For custom UIs, open a WebSocket to <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">ws://{'<voice-bridge-url>'}/voice</code>.
          </Step>
        </div>
      </section>

      {/* Zoom */}
      <section className="mb-10">
        <ChannelBadge color="border-[#2D8CFF]/30 bg-[#2D8CFF]/10 text-[#2D8CFF]">Zoom</ChannelBadge>
        <h2 className="mt-3 mb-3 text-lg font-bold text-white">Zoom (Meetings)</h2>
        <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
          Sandra can schedule and manage Zoom meetings on behalf of users.
          Requires a Zoom Server-to-Server OAuth app.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Create a Server-to-Server OAuth app in the{' '}
            <a href="https://marketplace.zoom.us" className="text-primary underline" target="_blank" rel="noopener">Zoom Marketplace</a>.
            Note the <strong>Account ID</strong>, <strong>Client ID</strong>, and <strong>Client Secret</strong>.
          </Step>
          <Step n={2}>
            Add to your environment:
          </Step>
        </div>
        <CodeBlock code={`ZOOM_ACCOUNT_ID=your-zoom-account-id
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret`} />
      </section>

      {/* Architecture note */}
      <section className="mb-10 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6">
        <h2 className="mb-3 text-lg font-bold text-white">Multi-tenant channel isolation</h2>
        <p className="text-sm leading-relaxed text-on-surface-variant">
          In multi-tenant deployments, each tenant can have its own set of channel credentials.
          Configure per-tenant channels via the admin dashboard under{' '}
          <strong>Settings → Channels</strong>, or directly in the{' '}
          <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">ProviderConfig</code>{' '}
          table. Sandra routes inbound messages to the correct tenant based on the phone number,
          page ID, or email address that received the message.
        </p>
      </section>

      {/* Footer */}
      <section className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/knowledge-base"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Knowledge Base &rarr;</p>
          <p className="text-xs text-on-surface-variant">Index your content for RAG retrieval.</p>
        </Link>
        <Link
          href="/docs/multi-tenant"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Multi-tenant &rarr;</p>
          <p className="text-xs text-on-surface-variant">Isolated tenants, tools, and branding.</p>
        </Link>
      </section>
    </div>
  );
}
