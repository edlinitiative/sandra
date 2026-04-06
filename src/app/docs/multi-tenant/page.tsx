import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Multi-tenant — Sandra Developer Docs',
  description: 'Run multiple isolated tenants on a single Sandra deployment.',
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

export default function MultiTenantPage() {
  return (
    <div className="prose-custom">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Architecture</p>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Multi-tenant</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Sandra supports full multi-tenancy on a single deployment. Each tenant gets isolated
          data, tools, channel credentials, knowledge base, and branding &mdash; all on shared infrastructure.
        </p>
      </div>

      {/* Isolation model */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">What&rsquo;s isolated per tenant</h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Layer</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Isolation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['Conversations & messages', 'Filtered by tenantId — no cross-tenant leakage'],
                ['Knowledge base (RAG)', 'Embeddings are tagged per tenant; retrieval is tenant-scoped'],
                ['Tools', 'Each tenant can have its own registered tools + enabled/disabled flags'],
                ['Channel credentials', 'WhatsApp, Instagram, email, Zoom — all per-tenant via ProviderConfig'],
                ['Google Workspace', 'Per-tenant service account delegation (Calendar, Drive, Gmail)'],
                ['Agent personality', 'Per-tenant system prompt, name, and behavior config'],
                ['Users & roles', 'Users belong to a tenant; roles (admin, user) are tenant-scoped'],
                ['Analytics', 'Dashboard stats are tenant-filtered'],
                ['API keys', 'Each tenant generates its own API keys'],
              ].map(([layer, isolation]) => (
                <tr key={layer} className="text-on-surface">
                  <td className="px-4 py-2.5 text-xs font-medium text-on-surface">{layer}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{isolation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Creating tenants */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Creating a tenant</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Tenants are created through the admin dashboard or the admin API. No external provisioning needed.
        </p>

        <h3 className="mb-2 mt-4 text-sm font-semibold text-white">Via Admin Dashboard</h3>
        <p className="mb-3 text-sm text-on-surface-variant">
          Navigate to <strong>Admin → Tenants → Create</strong>. Fill in the tenant name and slug.
          The tenant is immediately active with default settings.
        </p>

        <h3 className="mb-2 mt-4 text-sm font-semibold text-white">Via API</h3>
        <CodeBlock code={`curl -X POST $SANDRA_URL/api/admin/tenants \\
  -H "Authorization: Bearer $ADMIN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Acme Corp",
    "slug": "acme",
    "config": {
      "agentName": "Aria",
      "systemPrompt": "You are Aria, a helpful assistant for Acme Corp employees."
    }
  }'`} />

        <h3 className="mb-2 mt-4 text-sm font-semibold text-white">Via database seed</h3>
        <p className="mb-3 text-sm text-on-surface-variant">
          For initial setup or CI/CD, use the Prisma seed script:
        </p>
        <CodeBlock lang="typescript" code={`// prisma/seed-tenant.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

await prisma.tenant.create({
  data: {
    name: 'Acme Corp',
    slug: 'acme',
    settings: {
      agentName: 'Aria',
      defaultLanguage: 'en',
    },
  },
});`} />
      </section>

      {/* Per-tenant tools */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Per-tenant tool configuration</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Each tenant can have its own set of tools. Register tools via the admin API and
          assign them to specific tenants.
        </p>
        <CodeBlock lang="json" code={`// POST /api/admin/tools
{
  "name": "lookupOrder",
  "description": "Look up a customer order by ID",
  "endpoint": "https://api.acme.com/orders/{orderId}",
  "tenantId": "tenant-acme-001",
  "parameters": {
    "orderId": { "type": "string", "description": "The order ID to look up" }
  }
}`} />
        <p className="text-xs text-outline">
          Sandra will only offer this tool to users in the Acme tenant.
          Other tenants won&rsquo;t see or trigger it.
        </p>
      </section>

      {/* Per-tenant Google Workspace */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Per-tenant Google Workspace</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Each tenant can connect their own Google Workspace for Calendar, Drive, and Gmail integration.
          Store the service account credentials in the tenant&rsquo;s <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">ProviderConfig</code>:
        </p>
        <CodeBlock lang="json" code={`// In ProviderConfig for tenant
{
  "provider": "google",
  "tenantId": "tenant-acme-001",
  "config": {
    "serviceAccountEmail": "sa@acme-project.iam.gserviceaccount.com",
    "privateKey": "...",
    "delegatedUser": "admin@acme.com",
    "scopes": ["calendar", "drive", "gmail"]
  }
}`} />
      </section>

      {/* Per-tenant Zoom */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Per-tenant Zoom</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Similarly, each tenant can bring their own Zoom credentials for meeting scheduling:
        </p>
        <CodeBlock lang="json" code={`{
  "provider": "zoom",
  "tenantId": "tenant-acme-001",
  "config": {
    "accountId": "...",
    "clientId": "...",
    "clientSecret": "..."
  }
}`} />
      </section>

      {/* Passing tenantId */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">Passing tenantId in API calls</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          When calling the Chat API from a multi-tenant integration, include the{' '}
          <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-on-surface">tenantId</code>{' '}
          field so Sandra routes to the correct tenant context:
        </p>
        <CodeBlock code={`curl -X POST $SANDRA_URL/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Schedule a team meeting for tomorrow at 2pm",
    "sessionId": "s1",
    "userId": "u1",
    "tenantId": "tenant-acme-001"
  }'`} />
        <p className="text-xs text-outline">
          If the API key is tenant-scoped (generated from that tenant&rsquo;s admin panel),
          the tenantId is inferred automatically &mdash; you don&rsquo;t need to pass it explicitly.
        </p>
      </section>

      {/* User roles */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">User roles</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Users are scoped to a tenant and assigned a role:
        </p>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Role</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Permissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['super_admin', 'Full access across all tenants. Can create tenants, manage global config.'],
                ['admin', 'Full access within their tenant. Manage tools, channels, users, analytics.'],
                ['user', 'Chat with Sandra. View own conversations and preferences.'],
              ].map(([role, perms]) => (
                <tr key={role} className="text-on-surface">
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">{role}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{perms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <section className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/knowledge-base"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">&larr; Knowledge Base</p>
          <p className="text-xs text-on-surface-variant">Index your content for RAG retrieval.</p>
        </Link>
        <Link
          href="/docs/quickstart"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">&larr; Quickstart</p>
          <p className="text-xs text-on-surface-variant">Send your first message in 5 minutes.</p>
        </Link>
      </section>
    </div>
  );
}
