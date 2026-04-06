import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Connect GitHub — Sandra Admin Guides',
  description:
    'Index your repositories so Sandra can answer questions about your codebase.',
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

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm leading-relaxed text-on-surface">
      {children}
    </div>
  );
}

export default function GitHubPage() {
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
        <div className="mb-3 inline-flex ml-3 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white">
          ~5 min setup
        </div>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Connect GitHub</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Index your repositories so Sandra can answer questions about your codebase,
          architecture, and documentation.
        </p>
      </div>

      {/* Capabilities */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          What Sandra can do with GitHub
        </h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['Code knowledge', 'Answer questions about your codebase, architecture, and APIs'],
                ['Documentation lookup', 'Find and reference READMEs, docs, and inline comments'],
                ['Repository browsing', 'Navigate directory structures and read file contents'],
                ['Knowledge indexing', 'Chunk, embed, and index repo content for semantic search'],
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
        <strong>Prerequisites:</strong> A GitHub account with access to the repos you want to
        index, and Sandra Admin Portal access.
      </Callout>

      {/* Step 1 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">
          1. Create a Personal Access Token
        </h2>
        <div className="space-y-3">
          <Step n={1}>
            Go to{' '}
            <a
              href="https://github.com/settings/tokens"
              className="text-primary underline"
              target="_blank"
              rel="noopener"
            >
              github.com/settings/tokens
            </a>
          </Step>
          <Step n={2}>
            Click <strong>Generate new token</strong> →{' '}
            <strong>Generate new token (classic)</strong>
          </Step>
          <Step n={3}>
            Name:{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              Sandra AI - Repo Access
            </code>
            , Expiration: 90 days recommended
          </Step>
          <Step n={4}>
            Check the{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">repo</code>{' '}
            scope (for public-only repos, just{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              public_repo
            </code>
            )
          </Step>
          <Step n={5}>
            Click <strong>Generate token</strong> and copy it
          </Step>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">2. Configure Sandra</h2>

        <h3 className="mb-2 text-sm font-bold text-white">Option A: Environment variable</h3>
        <CodeBlock code={`GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx`} />

        <h3 className="mb-2 mt-6 text-sm font-bold text-white">Option B: Admin Portal</h3>
        <div className="space-y-3">
          <Step n={1}>
            Admin Portal → <strong>Settings</strong> → <strong>GitHub Connection</strong>
          </Step>
          <Step n={2}>Enter the Personal Access Token</Step>
          <Step n={3}>
            Click <strong>Save</strong>
          </Step>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">3. Register repositories</h2>
        <div className="space-y-3">
          <Step n={1}>
            Admin Portal → <strong>Dashboard → System</strong>
          </Step>
          <Step n={2}>
            Under <strong>Registered Repositories</strong>, click <strong>Add Repository</strong>
          </Step>
          <Step n={3}>
            Enter repos in{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">owner/repo</code>{' '}
            format (e.g.{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              your-org/frontend-app
            </code>
            )
          </Step>
        </div>
      </section>

      {/* Step 4 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">4. Index the repositories</h2>
        <div className="space-y-3">
          <Step n={1}>
            Click <strong>Index Repositories</strong> in the System tab
          </Step>
          <Step n={2}>
            Sandra will fetch files, filter by type, chunk content, generate embeddings, and store
            in the knowledge base
          </Step>
          <Step n={3}>
            Initial indexing may take a few minutes. Re-indexes are faster thanks to content hash
            change detection.
          </Step>
        </div>
      </section>

      {/* How indexing works */}
      <section className="mb-10 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6">
        <h2 className="mb-3 text-sm font-bold text-white">
          <span className="material-symbols-outlined mr-1 align-middle text-base text-primary">
            sync
          </span>
          How indexing works
        </h2>
        <ul className="space-y-1.5 text-xs leading-relaxed text-on-surface-variant">
          <li>
            • <strong className="text-on-surface">Change detection:</strong> Sandra hashes file
            content — only changed files are re-processed on re-index
          </li>
          <li>
            • <strong className="text-on-surface">File filtering:</strong> Only code and docs are
            indexed (no images, binaries, lock files, or node_modules)
          </li>
          <li>
            • <strong className="text-on-surface">Chunking:</strong> Large files are split into
            meaningful chunks for accurate search retrieval
          </li>
          <li>
            • <strong className="text-on-surface">Embeddings:</strong> Chunks are converted to
            vectors via OpenAI and stored in pgvector for semantic search
          </li>
        </ul>
      </section>

      {/* Verify */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">5. Verify</h2>
        <div className="space-y-3">
          <Step n={1}>
            In the Sandra chat, try:{' '}
            <em>&ldquo;What does the main README say about getting started?&rdquo;</em>
          </Step>
          <Step n={2}>
            Or: <em>&ldquo;How is authentication implemented in our API?&rdquo;</em>
          </Step>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Troubleshooting</h2>
        <div className="space-y-4">
          {[
            [
              'Authentication failed',
              'Verify the PAT hasn\u2019t expired and has the repo scope.',
            ],
            [
              'Repository not found',
              'The PAT owner must be a collaborator or org member. Use owner/repo format, not the full URL.',
            ],
            [
              'Sandra gives wrong answers about code',
              'Re-index to pick up recent changes. Be specific about which repo or file you\u2019re asking about.',
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
          <li>• PAT encrypted at rest; Sandra <strong className="text-on-surface">only reads</strong> — never pushes code or creates issues</li>
          <li>• Indexed content stored as vector embeddings, not raw files</li>
          <li>• Rotate the PAT before it expires — set a calendar reminder</li>
        </ul>
      </section>

      {/* Footer nav */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/admin/instagram"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">&larr; Connect Instagram</p>
          <p className="text-xs text-on-surface-variant">DM messaging channel.</p>
        </Link>
        <Link
          href="/docs/admin/external-apis"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">External APIs &rarr;</p>
          <p className="text-xs text-on-surface-variant">Connect any REST API.</p>
        </Link>
      </section>
    </div>
  );
}
