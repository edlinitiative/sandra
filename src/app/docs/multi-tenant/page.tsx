import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Multi-Tenant — Sandra Developer Docs',
  description: 'Isolate data, tools, and credentials per customer. Full white-label support.',
};

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

function IsolationRow({ feature, description }: { feature: string; description: string }) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-sm font-medium text-white">{feature}</td>
      <td className="px-4 py-2.5 text-sm text-slate-400">{description}</td>
    </tr>
  );
}

export default function MultiTenantPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sandra-400">Reference</p>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Multi-Tenant</h1>
        <p className="text-base leading-relaxed text-slate-400">
          Deploy Sandra for multiple customers on the same infrastructure — fully isolated.
          Each tenant has independent data, tools, credentials, and API keys.
        </p>
      </div>

      {/* What is a tenant */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">What is a tenant?</h2>
        <p className="mb-4 text-sm leading-relaxed text-slate-400">
          A <strong className="text-white">tenant</strong> is a fully isolated partition of Sandra.
          If you are building a SaaS product that embeds Sandra, each of your customers is a separate tenant.
          Tenants never see each other's conversations, memory, or configurations.
        </p>
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">What is isolated</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              <IsolationRow feature="Conversations & sessions" description="All chat history is scoped to a tenant. Tenant A's users never appear in Tenant B's data." />
              <IsolationRow feature="User memory" description="Long-term memory (facts, preferences) is per-user per-tenant." />
              <IsolationRow feature="Tool configuration" description="Each tenant can enable or disable any of Sandra's 66 tools independently." />
              <IsolationRow feature="Google Workspace" description="Each tenant can have its own service account with its own domain delegation." />
              <IsolationRow feature="Zoom credentials" description="Per-tenant Zoom server-to-server OAuth credentials." />
              <IsolationRow feature="API keys" description="Each tenant has its own admin API key for indexing and repo management." />
              <IsolationRow feature="Knowledge base" description="Indexed repositories and vector chunks are scoped per tenant." />
            </tbody>
          </table>
        </div>
      </section>

      {/* Requesting a tenant */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Requesting a tenant</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          Tenants are provisioned by EdLight. Contact{' '}
          <a href="mailto:hello@edlight.org" className="text-sandra-400 hover:underline">hello@edlight.org</a>{' '}
          with the following information:
        </p>
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/[0.04]">
              {[
                ['Organization name', 'Will become the tenant display name'],
                ['Slug', 'e.g. acme-corp — used in internal references'],
                ['Channels needed', 'Web chat, WhatsApp, Instagram, Email, Voice — any combination'],
                ['Integrations needed', 'Google Workspace, Zoom, Web Search, Knowledge Base'],
                ['Languages', 'English, French, Haitian Creole — any combination'],
              ].map(([field, desc]) => (
                <tr key={field}>
                  <td className="px-4 py-2.5 text-xs font-medium text-white">{field}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          You will receive a <strong className="text-white">tenantId</strong> and an{' '}
          <strong className="text-white">admin API key</strong>.
        </p>
      </section>

      {/* Per-tenant tool configuration */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Per-tenant tool configuration</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          Sandra has 66 tools. Not every tenant needs all of them. Tools are enabled or disabled
          per tenant at runtime — no redeployment required.
        </p>
        <div className="space-y-3">
          {[
            {
              example: 'Customer support platform',
              enabled: ['searchKnowledgeBase', 'webSearch', 'sendGmail', 'saveUserNote'],
              disabled: ['createZoomMeeting', 'listZoomRecordings', 'manageTenantUsers'],
            },
            {
              example: 'EdTech platform',
              enabled: ['getCourses', 'getEnrollments', 'getCertificates', 'recommendCourses', 'getLearningPath', 'trackLearningProgress'],
              disabled: ['createZoomMeeting', 'checkBirthdays'],
            },
            {
              example: 'HR / scheduling platform',
              enabled: ['createCalendarEvent', 'listCalendarEvents', 'createZoomMeeting', 'createTask', 'listTasks', 'queueReminder'],
              disabled: ['getCourses', 'searchScholarships'],
            },
          ].map((row) => (
            <div key={row.example} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{row.example}</p>
              <div className="flex flex-wrap gap-1.5">
                {row.enabled.map((t) => (
                  <span key={t} className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[0.6rem] text-emerald-400">{t}</span>
                ))}
                {row.disabled.map((t) => (
                  <span key={t} className="rounded-full bg-white/[0.04] px-2 py-0.5 font-mono text-[0.6rem] text-slate-600 line-through">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Tool configuration is managed via the admin dashboard or by contacting EdLight.
        </p>
      </section>

      {/* Per-tenant Google Workspace */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Per-tenant Google Workspace</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          Each tenant can connect its own Google Workspace domain. Sandra will use that tenant's
          service account for all Gmail, Drive, Calendar, Tasks, and Directory operations —
          completely isolated from other tenants.
        </p>
        <CodeBlock lang="env" code={`# Tenant-level Google Workspace credentials
GOOGLE_SERVICE_ACCOUNT_EMAIL=tenant-sa@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_WORKSPACE_DOMAIN=yourcustomer.com`} />
        <p className="mt-2 text-xs text-slate-500">
          These are stored as tenant provider config — not shared environment variables.
          Provide them to EdLight and they will be scoped to your tenant only.
        </p>
      </section>

      {/* Per-tenant Zoom */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Per-tenant Zoom</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          Connect your own Zoom account so Sandra creates meetings under your organization.
        </p>
        <CodeBlock lang="env" code={`ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...`} />
        <p className="mt-2 text-xs text-slate-500">
          Create a Server-to-Server OAuth app in the{' '}
          <a href="https://marketplace.zoom.us" className="text-sandra-400 hover:underline" target="_blank" rel="noopener noreferrer">Zoom App Marketplace</a>{' '}
          and share the credentials with EdLight for your tenant.
        </p>
      </section>

      {/* Passing tenantId */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Passing your tenant context</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          When calling Sandra from a multi-tenant deployment, include your <code className="rounded bg-white/[0.07] px-1.5 text-xs text-slate-200">tenantId</code> in
          the request body so Sandra resolves the correct tool set, credentials, and knowledge base.
        </p>
        <CodeBlock lang="json" code={`{
  "message":  "Schedule a Zoom call for tomorrow at 2pm",
  "sessionId": "session-abc",
  "userId":    "user-xyz",
  "tenantId":  "your-tenant-id",
  "language":  "en"
}`} />
      </section>

      {/* Roles */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">User roles</h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-400">
          Sandra's RBAC system supports four roles. Roles are assigned per user per tenant.
        </p>
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {[
                ['student', 'Standard user — chat, personal memory, course tools'],
                ['staff', 'Extended access — additional operational tools'],
                ['admin', 'Tenant management, user management, indexing, tool config'],
                ['superAdmin', 'Full platform access across all tenants'],
              ].map(([role, access]) => (
                <tr key={role}>
                  <td className="px-4 py-2.5 font-mono text-xs text-sandra-300">{role}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
