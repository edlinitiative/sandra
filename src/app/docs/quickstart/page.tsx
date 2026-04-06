import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Quickstart — Sandra Developer Docs',
  description: 'Send your first message to Sandra in minutes using the Chat API.',
};

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

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm leading-relaxed text-on-surface">
      {children}
    </div>
  );
}

export default function QuickstartPage() {
  return (
    <div className="prose-custom">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Getting Started</p>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Quickstart</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Send your first message to Sandra in under 5 minutes. No SDK required &mdash; just HTTP.
        </p>
      </div>

      <Callout>
        Throughout these docs, replace{' '}
        <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-primary">SANDRA_URL</code>{' '}
        with wherever your Sandra instance is deployed &mdash; e.g.{' '}
        <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-on-surface">https://sandra.example.com</code>{' '}
        or{' '}
        <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-on-surface">http://localhost:3000</code>{' '}
        for local development.
      </Callout>

      {/* Step 1 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">1. Send a message (JSON)</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          The simplest integration: a single <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-on-surface">POST</code> to{' '}
          <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-on-surface">/api/chat</code>.
          Sandra runs her full agent loop &mdash; RAG retrieval, tools, memory &mdash; and returns a response.
        </p>
        <CodeBlock lang="bash" code={`curl -X POST $SANDRA_URL/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "What services does your platform offer?",
    "sessionId": "my-session-001",
    "userId": "user-abc",
    "language": "en"
  }'`} />
        <CodeBlock lang="json" code={`{
  "response": "Based on the knowledge base, the platform offers...",
  "sessionId": "my-session-001",
  "toolsUsed": ["searchKnowledgeBase"],
  "language": "en"
}`} />
        <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Field</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Required</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['message', '✅', 'The user\u2019s message text'],
                ['sessionId', 'Recommended', 'Reuse across turns \u2014 Sandra keeps conversation history per session'],
                ['userId', 'Recommended', 'Stable user ID \u2014 Sandra builds long-term memory per user across sessions'],
                ['language', 'Optional', 'en \u00b7 fr \u00b7 ht (Haitian Creole). Falls back to user preference or auto-detect'],
                ['channel', 'Optional', 'web \u00b7 whatsapp \u00b7 instagram \u00b7 email \u00b7 voice. Controls response formatting'],
                ['tenantId', 'Optional', 'For multi-tenant deployments \u2014 routes to the correct tenant context'],
              ].map(([field, req, desc]) => (
                <tr key={field} className="text-on-surface">
                  <td className="px-4 py-2.5 font-mono text-xs text-on-surface">{field}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{req}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">2. Stream the response (SSE)</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          For chat UIs, use the streaming endpoint. Sandra emits tokens as they are generated.
        </p>
        <CodeBlock lang="javascript" code={`const res = await fetch(\`\${SANDRA_URL}/api/chat/stream\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Search the web for the latest news about AI in education',
    sessionId: 'my-session-001',
    userId: 'user-abc',
    language: 'en',
  }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  for (const line of decoder.decode(value).split('\\n')) {
    if (!line.startsWith('data: ')) continue;
    const event = JSON.parse(line.slice(6));

    if (event.type === 'token')     appendToUI(event.token);
    if (event.type === 'tool_call') showToolIndicator(event.tool);
    if (event.type === 'done')      finalizeMessage(event.response);
    if (event.type === 'error')     handleError(event.message);
  }
}`} />
        <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Event type</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Payload</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['start', '{ sessionId }', 'Stream has begun'],
                ['token', '{ token }', 'Incremental response text \u2014 append to your UI'],
                ['tool_call', '{ tool, input, result }', 'Sandra invoked a tool; show a \u201csearching\u2026\u201d indicator'],
                ['done', '{ response, sessionId, toolsUsed }', 'Final complete response; stream is finished'],
                ['error', '{ message }', 'An error occurred'],
              ].map(([type, payload, desc]) => (
                <tr key={type} className="text-on-surface">
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">{type}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-on-surface-variant">{payload}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">3. Maintain conversation history</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Pass the same <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-on-surface">sessionId</code> on every turn.
          Sandra automatically loads recent messages as context. Retrieve the full history at any time:
        </p>
        <CodeBlock lang="bash" code={`GET $SANDRA_URL/api/conversations/my-session-001`} />
      </section>

      {/* Step 4 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">4. Set the language</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Sandra responds natively in English, French, and Haitian Creole. Pass the language per request,
          or let Sandra remember it per user across sessions.
        </p>
        <CodeBlock lang="json" code={`{ "language": "ht" }   // Haitian Creole
{ "language": "fr" }   // French
{ "language": "en" }   // English (default)`} />
        <Callout>
          If you pass a <strong>userId</strong> and the user has a saved language preference, Sandra will use
          that preference as a fallback &mdash; even if you don&apos;t send a language field.
        </Callout>
      </section>

      {/* Self-hosting callout */}
      <section className="mb-10 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6">
        <h2 className="mb-3 text-lg font-bold text-white">Self-hosting Sandra</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Sandra is a standard Next.js app backed by PostgreSQL (with pgvector). To run your own instance:
        </p>
        <ol className="ml-4 list-decimal space-y-2 text-sm text-on-surface-variant">
          <li>Clone the repo and install dependencies</li>
          <li>Set up a PostgreSQL database with the pgvector extension</li>
          <li>Copy <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">.env.example</code> to <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">.env</code> and fill in your API keys (Gemini, OpenAI, etc.)</li>
          <li>Run <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">npx prisma migrate deploy</code> to create the schema</li>
          <li>Run <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">npx prisma db seed</code> to seed your first tenant</li>
          <li>Start with <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">npm run dev</code> or deploy to Vercel / any Node.js host</li>
        </ol>
        <p className="mt-3 text-xs text-outline">
          Sandra works on Vercel, Railway, Fly.io, a bare VM, or any platform that runs Node.js 20+.
        </p>
      </section>

      {/* Next steps */}
      <section className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/api-reference"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">API Reference &rarr;</p>
          <p className="text-xs text-on-surface-variant">Full endpoint reference with all parameters.</p>
        </Link>
        <Link
          href="/docs/channels"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Channels &rarr;</p>
          <p className="text-xs text-on-surface-variant">Connect WhatsApp, Instagram, email, or voice.</p>
        </Link>
      </section>
    </div>
  );
}
