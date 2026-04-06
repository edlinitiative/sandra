import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Reference — Sandra Developer Docs',
  description: 'Complete reference for all Sandra API endpoints.',
};

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'get' | 'post' | 'default' }) {
  const colors = {
    get: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    post: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    default: 'bg-white/[0.06] text-slate-300 border-white/[0.1]',
  };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[0.65rem] font-bold uppercase ${colors[variant]}`}>
      {children}
    </span>
  );
}

function EndpointTable({ rows }: { rows: { method: 'GET' | 'POST'; path: string; description: string; auth: string }[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Method</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Endpoint</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Auth</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {rows.map((row) => (
            <tr key={row.method + row.path}>
              <td className="px-4 py-2.5">
                <Badge variant={row.method === 'GET' ? 'get' : 'post'}>{row.method}</Badge>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-slate-200">{row.path}</td>
              <td className="px-4 py-2.5 text-xs text-slate-400">{row.description}</td>
              <td className="px-4 py-2.5 text-xs text-slate-500">{row.auth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/50">
      <div className="border-b border-white/[0.06] px-4 py-2">
        <span className="text-[0.625rem] font-medium uppercase tracking-widest text-slate-500">{lang}</span>
      </div>
      <pre className="p-4 text-sm leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ApiReferencePage() {
  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sandra-400">Reference</p>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">API Reference</h1>
        <p className="text-base leading-relaxed text-slate-400">
          All endpoints are relative to{' '}
          <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-slate-200">
            https://sandra.edlight.org
          </code>
          . Admin endpoints require an{' '}
          <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-slate-200">x-api-key</code>{' '}
          header.
        </p>
      </div>

      {/* Chat */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Chat</h2>
        <EndpointTable rows={[
          { method: 'POST', path: '/api/chat', description: 'Send a message — full JSON response after agent completes', auth: 'None' },
          { method: 'POST', path: '/api/chat/stream', description: 'Send a message — SSE stream of tokens + tool events', auth: 'None' },
          { method: 'GET', path: '/api/conversations/:sessionId', description: 'Retrieve full message history for a session', auth: 'None' },
        ]} />

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">POST /api/chat — Request body</h3>
            <CodeBlock lang="json" code={`{
  "message":   "What courses are on EdLight Academy?",  // required
  "sessionId": "session-uuid",                           // recommended
  "userId":    "user-uuid",                              // recommended
  "language":  "en",                                     // en | fr | ht
  "channel":   "web"                                     // web | whatsapp | instagram | email | voice
}`} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">POST /api/chat — Response</h3>
            <CodeBlock lang="json" code={`{
  "response":   "EdLight Academy offers...",
  "sessionId":  "session-uuid",
  "toolsUsed":  ["searchKnowledgeBase"],
  "language":   "en"
}`} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">POST /api/chat/stream — SSE events</h3>
            <CodeBlock lang="text" code={`data: {"type":"start","sessionId":"session-uuid"}

data: {"type":"token","token":"EdLight "}

data: {"type":"tool_call","tool":"searchKnowledgeBase","input":{...},"result":{...}}

data: {"type":"token","token":"Academy offers..."}

data: {"type":"done","response":"EdLight Academy offers...","sessionId":"session-uuid","toolsUsed":["searchKnowledgeBase"]}`} />
          </div>
        </div>
      </section>

      {/* Channel Webhooks */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Channel Webhooks</h2>
        <EndpointTable rows={[
          { method: 'POST', path: '/api/webhooks/whatsapp', description: 'Inbound WhatsApp messages from Meta Cloud API', auth: 'Meta X-Hub-Signature-256' },
          { method: 'GET', path: '/api/webhooks/whatsapp', description: 'Meta webhook challenge verification', auth: 'META_VERIFY_TOKEN' },
          { method: 'POST', path: '/api/webhooks/instagram', description: 'Inbound Instagram DMs from Meta', auth: 'Meta X-Hub-Signature-256' },
          { method: 'GET', path: '/api/webhooks/instagram', description: 'Meta webhook challenge verification', auth: 'META_VERIFY_TOKEN' },
        ]} />
      </section>

      {/* Voice */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Voice</h2>
        <EndpointTable rows={[
          { method: 'POST', path: '/api/voice/realtime-session', description: 'Mint an ephemeral OpenAI Realtime key with Sandra\'s system prompt pre-injected', auth: 'None' },
          { method: 'POST', path: '/api/voice/transcribe', description: 'Transcribe audio using Whisper', auth: 'None' },
          { method: 'POST', path: '/api/voice/tts', description: 'Synthesize speech from text using OpenAI TTS', auth: 'None' },
          { method: 'POST', path: '/api/voice/process', description: 'Full voice round-trip: transcribe → agent → TTS audio response', auth: 'None' },
        ]} />

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">POST /api/voice/realtime-session — Request</h3>
            <CodeBlock lang="json" code={`{ "userId": "user-uuid", "language": "en" }`} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">POST /api/voice/realtime-session — Response</h3>
            <CodeBlock lang="json" code={`{
  "client_secret": { "value": "eph_key_abc..." },
  "expires_at": 1712345678
}`} />
            <p className="mt-2 text-xs text-slate-500">
              Use the ephemeral key to connect a WebRTC client to{' '}
              <code className="text-slate-400">wss://api.openai.com/v1/realtime</code>.
              Sandra's identity, tools, and memory context are already injected.
            </p>
          </div>
        </div>
      </section>

      {/* Admin */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Admin & Operations</h2>
        <EndpointTable rows={[
          { method: 'GET', path: '/api/health', description: 'Service health: db, vectorStore, tool count, doc/chunk counts', auth: 'None' },
          { method: 'GET', path: '/api/repos', description: 'List all registered repos with indexing status', auth: 'x-api-key' },
          { method: 'POST', path: '/api/index', description: 'Trigger indexing for one repo or all repos', auth: 'x-api-key' },
        ]} />

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">GET /api/health — Response</h3>
            <CodeBlock lang="json" code={`{
  "status": "ok",
  "db": "ok",
  "vectorStore": "ok",
  "toolsRegistered": 66,
  "indexedDocs": 411,
  "vectorChunks": 373
}`} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">POST /api/index — Request</h3>
            <CodeBlock lang="json" code={`// Index a specific repo:
{ "repoId": "your-org/your-repo" }

// Re-index everything (omit repoId):
{}`} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">POST /api/index — Response</h3>
            <CodeBlock lang="json" code={`{ "success": true, "indexed": 42, "failed": 0 }`} />
          </div>
        </div>
      </section>

      {/* Crons */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Cron Endpoints</h2>
        <p className="mb-3 text-sm text-slate-400">
          These are triggered by Vercel's scheduler. You can also call them manually for testing.
        </p>
        <EndpointTable rows={[
          { method: 'GET', path: '/api/cron/daily-birthdays', description: 'Birthday alert: Google Sheets lookup → WhatsApp messages', auth: 'Vercel' },
          { method: 'GET', path: '/api/cron/email-poll', description: 'Poll Gmail for new inbound messages and process them', auth: 'Vercel' },
          { method: 'GET', path: '/api/cron/process-reminders', description: 'Dispatch all due reminders to users', auth: 'Vercel' },
        ]} />
      </section>
    </div>
  );
}
