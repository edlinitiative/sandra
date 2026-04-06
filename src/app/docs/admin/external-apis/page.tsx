import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Connect External APIs — Sandra Admin Guides',
  description:
    'Connect any REST API with an OpenAPI spec and auto-generate tools for Sandra.',
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

export default function ExternalApisPage() {
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
        <div className="mb-3 inline-flex ml-3 items-center gap-2 rounded-full border border-tertiary/30 bg-tertiary/10 px-3 py-1 text-xs font-medium text-tertiary">
          ~10 min setup
        </div>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">
          Connect External APIs
        </h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Connect any REST API that has an OpenAPI (Swagger) spec. Sandra auto-generates tools for
          each endpoint, making them immediately available in conversations.
        </p>
      </div>

      {/* Use cases */}
      <section className="mb-10 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6">
        <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          Example use cases
        </h2>
        <ul className="space-y-2">
          {[
            'Connect your CRM so Sandra can look up customer information',
            'Connect a project management tool (Jira, Linear, Asana) for task updates',
            'Connect your internal HR system for employee directory lookups',
            'Connect a shipping API to track orders',
            'Connect any SaaS with an API \u2014 if it has an OpenAPI spec, Sandra can use it',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5 text-base text-primary">
                check_circle
              </span>
              <span className="text-sm leading-relaxed text-on-surface/80">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <Callout>
        <strong>Prerequisites:</strong> An{' '}
        <strong>OpenAPI 3.x specification</strong> (JSON or YAML) for your API, API credentials,
        and Admin Portal access.
        Most APIs publish their spec — look for &ldquo;API Reference,&rdquo; &ldquo;Swagger,&rdquo;
        or &ldquo;OpenAPI&rdquo; in the docs.
      </Callout>

      {/* Step 1 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">1. Open the Integrations dashboard</h2>
        <div className="space-y-3">
          <Step n={1}>
            Admin Portal → <strong>Integrations</strong> tab
          </Step>
          <Step n={2}>
            You&rsquo;ll see the <strong>External API Connections</strong> panel
          </Step>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">2. Add a new connection</h2>
        <div className="space-y-3">
          <Step n={1}>
            Click <strong>+ New Connection</strong>
          </Step>
          <Step n={2}>
            Enter a <strong>Connection Name</strong> (e.g.{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">Acme CRM</code>
            ) and the <strong>Base URL</strong> (e.g.{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              https://api.acme.com/v2
            </code>
            )
          </Step>
          <Step n={3}>
            <strong>Paste</strong> or <strong>upload</strong> the OpenAPI 3.x spec (JSON or YAML)
          </Step>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">3. Configure authentication</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Select the auth type your API uses:
        </p>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Auth Type
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Fields
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['API Key', 'Header name + API key value'],
                ['Bearer Token', 'Token value'],
                ['Basic Auth', 'Username + password'],
                ['OAuth2 Client Credentials', 'Client ID + Client Secret + Token URL'],
                ['Custom Header', 'Header name + header value'],
              ].map(([type, fields]) => (
                <tr key={type}>
                  <td className="px-4 py-2.5 font-medium text-on-surface">{type}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{fields}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 4 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">4. Save and test</h2>
        <div className="space-y-3">
          <Step n={1}>
            Click <strong>Save Connection</strong> — Sandra parses the spec and auto-generates
            tools for each endpoint
          </Step>
          <Step n={2}>
            Click <strong>Test Connection</strong> to verify Sandra can reach the API
          </Step>
          <Step n={3}>
            You&rsquo;ll see a health indicator: ✅ Connected or ❌ Failed
          </Step>
        </div>
      </section>

      {/* Step 5 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">5. Manage individual tools</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          After saving, you&rsquo;ll see a list of auto-generated tools — one per API endpoint:
        </p>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15 bg-black/50 p-4 font-mono text-xs leading-relaxed text-on-surface">
          <div className="mb-2 text-on-surface-variant">Acme CRM — 6 tools generated</div>
          <div className="space-y-1">
            <div>✅ GET  /customers → List Customers</div>
            <div>✅ GET  /customers/{'{'} id {'}'} → Get Customer Details</div>
            <div>✅ POST /customers → Create Customer</div>
            <div className="text-on-surface-variant">❌ DELETE /customers/{'{'} id {'}'} → Delete Customer <span className="text-yellow-500">(disabled)</span></div>
            <div>✅ GET  /orders → List Orders</div>
            <div>✅ GET  /orders/{'{'} id {'}'} → Get Order Details</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          You can <strong>toggle tools on/off</strong> (e.g., disable DELETE endpoints),
          <strong> view handler code</strong>, and <strong>test individual endpoints</strong>.
        </p>
      </section>

      {/* Best practices */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          Best practices
        </h2>
        <div className="space-y-4">
          {[
            [
              'Start with read-only endpoints',
              'Enable GET endpoints first. Only enable POST/PUT/DELETE after testing thoroughly.',
            ],
            [
              'Review auto-generated descriptions',
              'Better tool descriptions help Sandra choose the right tool. Improve them if the OpenAPI summary is unclear.',
            ],
            [
              'Use focused specs',
              'If an API has hundreds of endpoints, provide a trimmed spec with only the relevant ones. Fewer, focused tools = better accuracy.',
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

      {/* Troubleshooting */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Troubleshooting</h2>
        <div className="space-y-4">
          {[
            [
              'Invalid OpenAPI spec',
              'Sandra requires OpenAPI 3.x (not Swagger 2.0). Validate at editor.swagger.io.',
            ],
            [
              'Connection test failed',
              'Check the base URL (no trailing slash), auth type, and credentials. Ensure Sandra\u2019s server can reach the API.',
            ],
            [
              'Sandra doesn\u2019t use the right tool',
              'Improve tool descriptions, disable unused tools, or ask Sandra to use a specific tool by name.',
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
          <li>• Credentials <strong className="text-on-surface">encrypted at rest</strong>, never exposed to end users</li>
          <li>• Each API call logged for audit purposes</li>
          <li>• Sandra only calls <strong className="text-on-surface">explicitly enabled</strong> tools</li>
          <li>• Revoke access anytime by updating or deleting the connection</li>
        </ul>
      </section>

      {/* Footer nav */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/admin/github"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">&larr; Connect GitHub</p>
          <p className="text-xs text-on-surface-variant">Repository knowledge indexing.</p>
        </Link>
        <Link
          href="/docs/admin/agent-settings"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Agent Settings &rarr;</p>
          <p className="text-xs text-on-surface-variant">Customize Sandra&rsquo;s personality.</p>
        </Link>
      </section>
    </div>
  );
}
