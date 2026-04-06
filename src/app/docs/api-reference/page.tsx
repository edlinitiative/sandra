import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'API Reference — Sandra Developer Docs',
  description: 'Complete endpoint reference for the Sandra AI agent platform.',
};

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-0.5 text-[0.625rem] font-semibold uppercase tracking-widest text-primary">
      {children}
    </span>
  );
}

function EndpointTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-outline-variant/15">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Method</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Endpoint</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {rows.map(([method, path, desc]) => (
            <tr key={`${method}-${path}`} className="text-on-surface">
              <td className="px-4 py-2.5">
                <span className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${method === 'POST' ? 'bg-tertiary/15 text-tertiary' : method === 'GET' ? 'bg-primary/15 text-primary' : 'bg-error/15 text-error'}`}>
                  {method}
                </span>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-on-surface">{path}</td>
              <td className="px-4 py-2.5 text-xs text-on-surface-variant">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
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

export default function ApiReferencePage() {
  return (
    <div className="prose-custom">
      <div className="mb-8">
        <Badge>REST API</Badge>
        <h1 className="mt-4 mb-3 text-3xl font-black tracking-tighter text-white">API Reference</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Every endpoint on your Sandra instance. All paths below are relative to your
          deployment URL &mdash; e.g.{' '}
          <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-on-surface">https://sandra.example.com</code>{' '}
          or{' '}
          <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-on-surface">http://localhost:3000</code>.
        </p>
      </div>

      {/* Chat */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Chat</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          The core conversational interface. Sandra runs her full agent loop &mdash; memory, RAG, tools &mdash; and
          returns a response or a token stream.
        </p>
        <EndpointTable rows={[
          ['POST', '/api/chat', 'Send a message, receive a JSON response'],
          ['POST', '/api/chat/stream', 'Send a message, receive an SSE token stream'],
          ['GET', '/api/conversations/:sessionId', 'Retrieve full conversation history'],
        ]} />
        <CodeBlock code={`curl -X POST $SANDRA_URL/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{ "message": "hello", "sessionId": "s1", "userId": "u1" }'`} />
      </section>

      {/* Webhooks */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Webhooks (Channels)</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Inbound webhook endpoints for messaging platforms. These are configured in each
          platform&rsquo;s developer console to point at your Sandra deployment.
        </p>
        <EndpointTable rows={[
          ['POST', '/api/webhooks/whatsapp', 'Receives WhatsApp Business messages (via Meta webhook)'],
          ['GET', '/api/webhooks/whatsapp', 'WhatsApp webhook verification handshake'],
          ['POST', '/api/webhooks/instagram', 'Receives Instagram DMs (via Meta webhook)'],
          ['GET', '/api/webhooks/instagram', 'Instagram webhook verification handshake'],
          ['POST', '/api/webhooks/email', 'Receives inbound email (Gmail push notification or polling trigger)'],
        ]} />
      </section>

      {/* Voice */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Voice</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Real-time voice conversation via WebSocket. The voice bridge handles STT, agent processing,
          and TTS in a single streaming connection.
        </p>
        <EndpointTable rows={[
          ['WS', '/voice', 'WebSocket for real-time voice — the voice-bridge service handles STT → Agent → TTS'],
          ['GET', '/api/voice/health', 'Voice bridge health check'],
        ]} />
        <p className="text-xs text-outline">
          The voice bridge is a standalone service deployed alongside Sandra. See{' '}
          <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">voice-bridge/</code>{' '}
          in the repo.
        </p>
      </section>

      {/* Knowledge Base / Indexing */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Knowledge Base &amp; Indexing</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Index your own content into Sandra&rsquo;s RAG pipeline. Content is chunked, embedded, and
          stored in pgvector for retrieval.
        </p>
        <EndpointTable rows={[
          ['POST', '/api/index', 'Index documents (text, markdown, or file upload)'],
          ['POST', '/api/repos', 'Register a GitHub/GitLab repo for automatic indexing'],
          ['GET', '/api/repos', 'List registered repositories'],
          ['GET', '/api/health', 'General health check (includes index stats)'],
        ]} />
      </section>

      {/* Admin */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Admin</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Admin endpoints for managing tenants, tools, users, and analytics. Protected by
          admin-role authentication.
        </p>
        <EndpointTable rows={[
          ['GET', '/api/admin/tenants', 'List all tenants'],
          ['POST', '/api/admin/tenants', 'Create a new tenant'],
          ['GET', '/api/admin/analytics', 'Dashboard analytics (messages, users, satisfaction)'],
          ['GET', '/api/admin/tools', 'List registered tools for a tenant'],
          ['POST', '/api/admin/tools', 'Register a new dynamic tool'],
          ['GET', '/api/admin/api-keys', 'List API keys for a tenant'],
          ['POST', '/api/admin/api-keys', 'Generate a new API key'],
        ]} />
      </section>

      {/* Crons / Scheduled tasks */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Scheduled Tasks (Crons)</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          These endpoints are designed to be called by a scheduler (Vercel Cron, Railway Cron,
          a system crontab, or any HTTP-based scheduler). They perform periodic tasks like
          processing reminders or polling email.
        </p>
        <EndpointTable rows={[
          ['POST', '/api/cron/process-reminders', 'Check and fire due reminders'],
          ['POST', '/api/cron/email-poll', 'Poll connected Gmail inboxes for new messages'],
        ]} />
        <CodeBlock code={`# Example: crontab entry that runs reminders every 5 minutes
*/5 * * * * curl -X POST $SANDRA_URL/api/cron/process-reminders -H "Authorization: Bearer $CRON_SECRET"

# Or add to vercel.json:
# { "crons": [{ "path": "/api/cron/process-reminders", "schedule": "*/5 * * * *" }] }`} />
      </section>

      {/* Authentication */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Authentication</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Sandra supports two authentication modes:
        </p>
        <div className="space-y-4">
          <div className="rounded-xl border border-outline-variant/15 p-4">
            <h3 className="mb-1 text-sm font-semibold text-white">API Key (external integrations)</h3>
            <p className="text-xs text-on-surface-variant">
              Pass your tenant API key in the{' '}
              <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">Authorization: Bearer {'<key>'}</code>{' '}
              header. Generate keys from the Admin dashboard or via the admin API.
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant/15 p-4">
            <h3 className="mb-1 text-sm font-semibold text-white">Session (web UI)</h3>
            <p className="text-xs text-on-surface-variant">
              The built-in chat UI uses NextAuth session cookies. Supports Google OAuth,
              email magic links, or any NextAuth provider you configure.
            </p>
          </div>
        </div>
      </section>

      {/* Footer link */}
      <section className="mt-12">
        <Link
          href="/docs/channels"
          className="inline-block rounded-xl border border-outline-variant/15 bg-surface-container-low/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          Channels setup &rarr;
        </Link>
      </section>
    </div>
  );
}
