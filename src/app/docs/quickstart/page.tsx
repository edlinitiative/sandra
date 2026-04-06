import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Quickstart — Sandra Developer Docs',
  description: 'Send your first message to Sandra in minutes using the Chat API.',
};

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/50">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
        <span className="text-[0.625rem] font-medium uppercase tracking-widest text-slate-500">{lang}</span>
      </div>
      <pre className="p-4 text-sm leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-sandra-500/20 bg-sandra-500/[0.06] px-4 py-3 text-sm leading-relaxed text-slate-300">
      {children}
    </div>
  );
}

export default function QuickstartPage() {
  return (
    <div className="prose-custom">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sandra-400">Getting Started</p>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Quickstart</h1>
        <p className="text-base leading-relaxed text-slate-400">
          Send your first message to Sandra in under 5 minutes. No SDK required — just HTTP.
        </p>
      </div>

      {/* Step 1 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">1. Send a message (JSON)</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          The simplest integration: a single <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-slate-200">POST</code> to{' '}
          <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-slate-200">/api/chat</code>.
          Sandra runs her full agent loop — RAG retrieval, 66 tools, memory — and returns a response.
        </p>
        <CodeBlock lang="bash" code={`curl -X POST https://sandra.edlight.org/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "What courses are available on EdLight Academy?",
    "sessionId": "my-session-001",
    "userId": "user-abc",
    "language": "en"
  }'`} />
        <CodeBlock lang="json" code={`{
  "response": "EdLight Academy offers courses in...",
  "sessionId": "my-session-001",
  "toolsUsed": ["searchKnowledgeBase"],
  "language": "en"
}`} />
        <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Field</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Required</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {[
                ['message', '✅', 'The user\'s message text'],
                ['sessionId', 'Recommended', 'Reuse the same value across turns — Sandra uses it to keep conversation history'],
                ['userId', 'Recommended', 'Stable user ID — Sandra builds long-term memory per user across sessions'],
                ['language', 'Optional', 'en · fr · ht (Haitian Creole). Falls back to user preference or auto-detect'],
                ['channel', 'Optional', 'web · whatsapp · instagram · email · voice. Controls response formatting'],
              ].map(([field, req, desc]) => (
                <tr key={field} className="text-slate-300">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-200">{field}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{req}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">2. Stream the response (SSE)</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          For chat UIs, use the streaming endpoint. Sandra emits tokens as they are generated.
        </p>
        <CodeBlock lang="javascript" code={`const res = await fetch('https://sandra.edlight.org/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Search the web for the latest news from Haiti',
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
        <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Event type</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Payload</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {[
                ['start', '{ sessionId }', 'Stream has begun'],
                ['token', '{ token }', 'Incremental response text — append to your UI'],
                ['tool_call', '{ tool, input, result }', 'Sandra invoked a tool; show "searching…" indicator'],
                ['done', '{ response, sessionId, toolsUsed }', 'Final complete response; stream is finished'],
                ['error', '{ message }', 'An error occurred'],
              ].map(([type, payload, desc]) => (
                <tr key={type} className="text-slate-300">
                  <td className="px-4 py-2.5 font-mono text-xs text-sandra-300">{type}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{payload}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">3. Maintain conversation history</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          Pass the same <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-slate-200">sessionId</code> on every turn.
          Sandra automatically loads the last N messages as context for each new request.
          Retrieve the full history at any time:
        </p>
        <CodeBlock lang="bash" code={`GET https://sandra.edlight.org/api/conversations/my-session-001`} />
      </section>

      {/* Step 4 — language */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">4. Set the language</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          Sandra responds natively in English, French, and Haitian Creole. Pass the language per request,
          or store it once in user memory and Sandra will use it automatically.
        </p>
        <CodeBlock lang="json" code={`{ "language": "ht" }   // Haitian Creole
{ "language": "fr" }   // French
{ "language": "en" }   // English (default)`} />
        <Callout>
          If you pass a <strong>userId</strong> and the user has a saved language preference, Sandra will use
          that preference as a fallback for new sessions — even if you don't send a language field.
        </Callout>
      </section>

      {/* Next steps */}
      <section className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/api-reference"
          className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm transition-colors hover:border-sandra-500/30 hover:bg-sandra-500/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">API Reference →</p>
          <p className="text-xs text-slate-400">Full endpoint reference with all parameters.</p>
        </Link>
        <Link
          href="/docs/channels"
          className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm transition-colors hover:border-sandra-500/30 hover:bg-sandra-500/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Channels →</p>
          <p className="text-xs text-slate-400">Connect WhatsApp, Instagram, email, or voice.</p>
        </Link>
      </section>
    </div>
  );
}
