import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Knowledge Base — Sandra Developer Docs',
  description: 'Index your content into Sandra\u2019s RAG pipeline for intelligent retrieval.',
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

export default function KnowledgeBasePage() {
  return (
    <div className="prose-custom">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">RAG Pipeline</p>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Knowledge Base</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Sandra retrieves relevant context from your indexed content before every response.
          You control what goes into the knowledge base &mdash; documents, repos, or raw text via the API.
        </p>
      </div>

      {/* Pipeline */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">How it works</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-on-surface-variant">
          {['Ingest', 'Chunk', 'Embed', 'Store (pgvector)', 'Retrieve at query time'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low px-3 py-2">{step}</div>
              {i < 4 && <span className="text-outline">→</span>}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-on-surface-variant">
          When a user asks a question, Sandra generates an embedding of the query and performs a cosine-similarity
          search against your indexed content. The top chunks are injected into the agent&rsquo;s context window.
        </p>
      </section>

      {/* Option A: Register a repo */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Option A: Register a Git repository</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Point Sandra at a GitHub or GitLab repository and she&rsquo;ll clone, chunk, and embed the
          contents automatically. Markdown, text, and code files are all indexed.
        </p>
        <CodeBlock code={`curl -X POST $SANDRA_URL/api/repos \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://github.com/your-org/your-docs",
    "branch": "main",
    "tenantId": "your-tenant-id"
  }'`} />
        <p className="text-xs text-outline">
          Re-index at any time by calling the same endpoint. Sandra diffs and re-embeds only changed files.
        </p>
      </section>

      {/* Option B: Index via API */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Option B: Index documents via API</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Push individual documents or text directly. Useful for CMS content, database exports,
          or any content that isn&rsquo;t in a git repo.
        </p>
        <CodeBlock code={`curl -X POST $SANDRA_URL/api/index \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Your document text goes here...",
    "metadata": {
      "source": "handbook",
      "title": "Employee Onboarding Guide",
      "category": "hr"
    },
    "tenantId": "your-tenant-id"
  }'`} />
        <Callout>
          <strong>API key:</strong> Generate one from the Admin dashboard under{' '}
          <strong>Settings → API Keys</strong>, or via{' '}
          <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">POST /api/admin/api-keys</code>.
        </Callout>
      </section>

      {/* Option C: Check status */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Option C: Check indexing status</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          List registered repos and their indexing status:
        </p>
        <CodeBlock code={`curl $SANDRA_URL/api/repos \\
  -H "Authorization: Bearer $API_KEY"`} />
        <CodeBlock lang="json" code={`[
  {
    "id": "repo-001",
    "url": "https://github.com/your-org/your-docs",
    "branch": "main",
    "status": "indexed",
    "chunks": 342,
    "lastIndexed": "2025-04-01T12:00:00Z"
  }
]`} />
      </section>

      {/* Retrieval example */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Retrieval in action</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          You don&rsquo;t need to call a separate retrieval endpoint &mdash; Sandra handles it
          automatically during conversation. When a user sends a message, the agent:
        </p>
        <ol className="ml-4 list-decimal space-y-2 text-sm text-on-surface-variant">
          <li>Generates an embedding of the user&rsquo;s message</li>
          <li>Searches pgvector for the top-k relevant chunks (filtered by tenant)</li>
          <li>Injects the retrieved context into the prompt</li>
          <li>Generates a grounded response with source citations</li>
        </ol>
        <p className="mt-3 text-xs text-outline">
          Sandra cites sources in her responses so users can verify the information.
          The <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">toolsUsed</code> field
          in the API response shows when RAG was invoked.
        </p>
      </section>

      {/* Health check */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Health check</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Verify the knowledge base is operational and check index stats:
        </p>
        <CodeBlock code={`curl $SANDRA_URL/api/health`} />
        <CodeBlock lang="json" code={`{
  "status": "ok",
  "database": "connected",
  "embeddings": { "totalChunks": 1247, "repos": 3 }
}`} />
      </section>

      {/* Footer */}
      <section className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/multi-tenant"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Multi-tenant &rarr;</p>
          <p className="text-xs text-on-surface-variant">Tenant isolation, tools, and branding.</p>
        </Link>
        <Link
          href="/docs/api-reference"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">&larr; API Reference</p>
          <p className="text-xs text-on-surface-variant">Full endpoint reference.</p>
        </Link>
      </section>
    </div>
  );
}
