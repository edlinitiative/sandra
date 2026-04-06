import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Channels — Sandra Developer Docs',
  description: 'Connect Sandra to WhatsApp, Instagram, email, and voice.',
};

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {number}
      </div>
      <div className="flex-1 pb-8">
        <h3 className="mb-2 font-semibold text-white">{title}</h3>
        <div className="text-sm leading-relaxed text-on-surface-variant">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-outline-variant/15 bg-black/50">
      <div className="border-b border-outline-variant/15 px-4 py-2">
        <span className="text-[0.625rem] font-medium uppercase tracking-widest text-on-surface-variant">{lang}</span>
      </div>
      <pre className="p-4 text-sm leading-relaxed text-on-surface">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ChannelBadge({ live }: { live: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium ${live ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-on-surface-variant'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      {live ? 'Live' : 'Pending operator step'}
    </span>
  );
}

export default function ChannelsPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Reference</p>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Channels</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Sandra normalizes every channel into a unified message format. Your users get the same
          AI experience whether they reach Sandra via WhatsApp, Instagram, the web, email, or voice.
        </p>
      </div>

      {/* WhatsApp */}
      <section className="mb-12">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
            <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">WhatsApp</h2>
            <ChannelBadge live={true} />
          </div>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-on-surface-variant">
          Sandra handles inbound WhatsApp messages via the Meta Cloud API and replies automatically.
          Users interact in their natural language. Sandra maintains conversation continuity per phone number.
        </p>

        <div className="space-y-0 border-l border-outline-variant/15 pl-4">
          <Step number={1} title="Create a Meta App">
            Go to <a href="https://developers.facebook.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">developers.facebook.com</a> → Create App → Business → add the <strong className="text-white">WhatsApp</strong> product → register your business phone number.
          </Step>
          <Step number={2} title="Configure the webhook">
            In Meta Developer Console → WhatsApp → Configuration:
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li><strong className="text-white">Webhook URL:</strong> <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">https://sandra.edlight.org/api/webhooks/whatsapp</code></li>
              <li><strong className="text-white">Verify token:</strong> the value of <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">META_VERIFY_TOKEN</code> (provided by EdLight for your tenant)</li>
              <li><strong className="text-white">Subscribe to:</strong> <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">messages</code></li>
            </ul>
          </Step>
          <Step number={3} title="Provide credentials to EdLight">
            Share these values for your tenant&apos;s provider config:
            <CodeBlock lang="env" code={`WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
META_APP_SECRET=...
META_VERIFY_TOKEN=...`} />
          </Step>
          <Step number={4} title="Done — test it">
            Send a WhatsApp message to your registered number. Sandra will reply within seconds.
          </Step>
        </div>
      </section>

      {/* Instagram */}
      <section className="mb-12">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/10">
            <svg className="h-5 w-5 text-pink-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Instagram</h2>
            <ChannelBadge live={true} />
          </div>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-on-surface-variant">
          Sandra handles Instagram DMs through the Meta Messaging API using the same approach as WhatsApp.
        </p>

        <div className="space-y-0 border-l border-outline-variant/15 pl-4">
          <Step number={1} title="Add the Instagram product to your Meta App">
            In your existing Meta App (or a new one), add the <strong className="text-white">Instagram</strong> product. Connect your Instagram Business account.
          </Step>
          <Step number={2} title="Configure the webhook">
            <ul className="ml-4 list-disc space-y-1">
              <li><strong className="text-white">Webhook URL:</strong> <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">https://sandra.edlight.org/api/webhooks/instagram</code></li>
              <li><strong className="text-white">Verify token:</strong> same <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">META_VERIFY_TOKEN</code></li>
              <li><strong className="text-white">Subscribe to:</strong> <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">messages</code></li>
            </ul>
          </Step>
          <Step number={3} title="Provide credentials to EdLight">
            <CodeBlock lang="env" code={`INSTAGRAM_PAGE_ACCESS_TOKEN=...
META_APP_SECRET=...
META_VERIFY_TOKEN=...`} />
          </Step>
        </div>
      </section>

      {/* Email */}
      <section className="mb-12">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
            <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Email</h2>
            <ChannelBadge live={true} />
          </div>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-on-surface-variant">
          Sandra polls a Gmail inbox every 5 minutes, processes inbound emails as agent conversations,
          and replies via the Gmail API. Ideal for support inboxes, enrollment inquiries, or automated workflows.
        </p>

        <div className="space-y-0 border-l border-outline-variant/15 pl-4">
          <Step number={1} title="Set up a Google Workspace service account">
            In Google Cloud Console, create a service account with Gmail API access.
            Enable domain-wide delegation and grant it the <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">https://mail.google.com/</code> scope for the target inbox address.
          </Step>
          <Step number={2} title="Provide credentials to EdLight">
            <CodeBlock lang="env" code={`GOOGLE_SERVICE_ACCOUNT_EMAIL=sandra@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_WORKSPACE_DOMAIN=yourdomain.com`} />
          </Step>
          <Step number={3} title="Sandra starts polling automatically">
            The <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">email-poll</code> cron runs every 5 minutes.
            Unread messages in the inbox are processed and replied to automatically.
          </Step>
        </div>
      </section>

      {/* Voice */}
      <section className="mb-12">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
            <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Voice</h2>
            <ChannelBadge live={true} />
          </div>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-on-surface-variant">
          Sandra supports two voice modes: real-time bidirectional voice via WebRTC (OpenAI Realtime API),
          and a REST round-trip for non-WebRTC environments. Both inject Sandra&apos;s full system prompt and memory.
        </p>

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-white">Option A — WebRTC (real-time, low-latency)</h3>
          <p className="mb-3 text-sm text-on-surface-variant">
            Mint an ephemeral key from your server, then connect a WebRTC client directly to OpenAI Realtime.
            Sandra&apos;s identity, tools, and user memory are pre-injected in every session.
          </p>
          <CodeBlock lang="javascript" code={`// 1. Server-side: mint the session key
const { client_secret } = await fetch('https://sandra.edlight.org/api/voice/realtime-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'user-abc', language: 'ht' }),
}).then(r => r.json());

// 2. Client-side: connect using the ephemeral key
const pc = new RTCPeerConnection();
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
stream.getTracks().forEach(track => pc.addTrack(track, stream));

const dc = pc.createDataChannel('oai-events');
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

const response = await fetch('https://api.openai.com/v1/realtime', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${client_secret.value}\`,
    'Content-Type': 'application/sdp',
  },
  body: offer.sdp,
});
await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });`} />
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Option B — REST round-trip</h3>
          <p className="mb-3 text-sm text-on-surface-variant">
            For mobile apps, IVR systems, or any platform without WebRTC. Send audio, get audio back.
          </p>
          <CodeBlock lang="bash" code={`curl -X POST https://sandra.edlight.org/api/voice/process \\
  -F "audio=@recording.webm" \\
  -F "sessionId=session-001" \\
  -F "userId=user-abc" \\
  -F "language=fr"`} />
          <p className="mt-2 text-xs text-on-surface-variant">
            Returns an audio blob (MP3) plus the text transcript and agent response.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
          <p className="mb-1 text-xs font-semibold text-violet-300">Voice Bridge</p>
          <p className="text-xs leading-relaxed text-on-surface-variant">
            The Voice Bridge at <code className="text-on-surface">https://voice.edlight.org</code> is a standalone WebSocket relay
            service for full-duplex voice from web browsers. Web clients connect to it directly —
            no need to handle OpenAI Realtime credentials on the client side.
          </p>
        </div>
      </section>
    </div>
  );
}
