import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Knowledge Base — Sandra Developer Docs',
  description: 'Index your own content so Sandra can answer questions about your platform.',
};

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
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

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-sandra-500/20 bg-sandra-500/[0.06] px-4 py-3 text-sm leading-relaxed text-slate-300">
      {children}
    </div>
  );
}

export default function KnowledgeBasePage() {
  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sandra-400">Reference</p>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Knowledge Base</h1>
        <p className="text-base leading-relaxed text-slate-400">
          Sandra uses retrieval-augmented generation (RAG). Index your own GitHub repositories and
          Sandra will ground her answers in your content — documentation, READMEs, changelogs,
          course materials, anything in Markdown or plain text.
        </p>
      </div>

      {/* How it works */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">How indexing works</h2>
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex flex-col divide-y divide-white/[0.04] sm:flex-row sm:divide-x sm:divide-y-0">
            {[
              { step: '1', label: 'Fetch', desc: 'Sandra fetches README and docs from your GitHub repo via the API' },
              { step: '2', label: 'Chunk', desc: 'Content is split into overlapping segments (~500 tokens each)' },
              { step: '3', label: 'Embed', desc: 'Each chunk is embedded using OpenAI text-embedding-3-small' },
              { step: '4', label: 'Store', desc: 'Vectors stored in pgvector alongside the source text' },
              { step: '5', label: 'Retrieve', desc: 'On every chat request, the top-k most relevant chunks are injected into Sandra\'s context' },
            ].map((item) => (
              <div key={item.step} className="flex-1 p-5">
                <div className="mb-2 text-lg font-black text-sandra-400">{item.step}</div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-white">{item.label}</div>
                <div className="text-xs leading-relaxed text-slate-400">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-400">
          Indexable file extensions: <code className="rounded bg-white/[0.07] px-1.5 text-xs text-slate-200">.md .mdx .txt .rst .json .yaml .yml .toml .ts .tsx .js .jsx .py</code>
        </div>
      </section>

      {/* Option A */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Option A — Register a GitHub repository</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          The simplest option. Provide EdLight with your repository details and we'll register it.
          Sandra will index it on demand and include it in every knowledge retrieval.
        </p>
        <p className="mb-3 text-sm text-slate-400">Provide these details:</p>
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/[0.04]">
              {[
                ['Repository URL', 'https://github.com/your-org/your-repo'],
                ['Branch', 'main (or your default branch)'],
                ['Docs path', 'docs/ (optional — Sandra will also fetch the README and top-level .md files)'],
                ['Display name', 'What to call your platform in Sandra\'s knowledge'],
              ].map(([field, example]) => (
                <tr key={field}>
                  <td className="px-4 py-2.5 text-xs font-medium text-white">{field}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Option B */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Option B — Trigger indexing via API</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          If your repo is already registered, trigger a re-index at any time using the admin API.
          Useful after shipping new documentation.
        </p>
        <CodeBlock lang="bash" code={`# Index a specific repo
curl -X POST https://sandra.edlight.org/api/index \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: your-admin-api-key" \\
  -d '{ "repoId": "your-org/your-repo" }'

# Re-index everything
curl -X POST https://sandra.edlight.org/api/index \\
  -H "x-api-key: your-admin-api-key"`} />
        <CodeBlock lang="json" code={`{ "success": true, "indexed": 42, "failed": 0 }`} />
        <Callout>
          <strong>Admin API key</strong> — The <code className="rounded bg-white/[0.07] px-1.5 text-xs">x-api-key</code> header
          must match the <code className="rounded bg-white/[0.07] px-1.5 text-xs">ADMIN_API_KEY</code> configured for your tenant.
          Contact EdLight to receive your key.
        </Callout>
      </section>

      {/* Option C */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Option C — Check indexing status</h2>
        <CodeBlock lang="bash" code={`curl https://sandra.edlight.org/api/repos \\
  -H "x-api-key: your-admin-api-key"`} />
        <CodeBlock lang="json" code={`[
  {
    "id": "your-org/your-repo",
    "displayName": "Your Platform",
    "isActive": true,
    "lastIndexed": "2026-04-05T10:00:00Z",
    "docCount": 42
  }
]`} />
      </section>

      {/* What Sandra retrieves */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">What Sandra retrieves at chat time</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          When a user sends a message, Sandra embeds the message and performs a cosine similarity search
          across all indexed chunks for the tenant. The top results are injected into the system prompt
          before the LLM call. Sandra cites the source repository in her answers.
        </p>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Example</p>
          <div className="space-y-2">
            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
              <span className="text-xs font-medium text-slate-400">User →</span>
              <p className="mt-1 text-sm text-white">"How do I integrate the payment module?"</p>
            </div>
            <div className="rounded-lg bg-sandra-500/[0.06] px-3 py-2">
              <span className="text-xs font-medium text-sandra-400">Sandra →</span>
              <p className="mt-1 text-sm text-slate-300">
                Retrieves the 3 most relevant chunks from your indexed docs,
                then answers using that content as grounded context.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Health check */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Verify indexing via health check</h2>
        <CodeBlock lang="bash" code={`curl https://sandra.edlight.org/api/health`} />
        <CodeBlock lang="json" code={`{
  "status": "ok",
  "db": "ok",
  "vectorStore": "ok",
  "indexedDocs": 411,
  "vectorChunks": 373
}`} />
      </section>
    </div>
  );
}
