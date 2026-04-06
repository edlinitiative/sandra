import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Connect Google Workspace — Sandra Admin Guides',
  description:
    'Give Sandra access to Gmail, Calendar, Drive, Tasks, Forms, and Contacts via a Google Cloud service account.',
};

/* ─── Shared components ─── */

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

/* ─── Scopes data ─── */

const scopes = [
  ['drive.readonly', 'Read-only', 'Search and read files in Google Drive'],
  ['drive.file', 'Read/write (created files)', 'Create Google Docs and Sheets'],
  ['gmail.send', 'Send only', 'Send emails on behalf of users'],
  ['gmail.compose', 'Create drafts', 'Save email drafts'],
  ['gmail.readonly', 'Read-only', 'Search and read email messages'],
  ['gmail.modify', 'Mark read / labels', 'Mark emails as read after processing'],
  ['admin.directory.user.readonly', 'Read-only', 'Look up team members in the directory'],
  ['admin.directory.group.readonly', 'Read-only', 'Look up groups / teams'],
  ['calendar', 'Full access', 'Create, read, update, delete calendar events'],
  ['calendar.events', 'Events only', 'Manage calendar events'],
  ['tasks', 'Full access', 'Create, list, complete, delete tasks'],
  ['forms.body', 'Create / edit', 'Create Google Forms with questions'],
  ['forms.responses.readonly', 'Read-only', 'Read form submission responses'],
  ['contacts.readonly', 'Read-only', 'Look up contact details and birthdays'],
  ['spreadsheets.readonly', 'Read-only', 'Read data from Google Sheets'],
];

const fullScopeList = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
].join(',');

/* ─── Capabilities data ─── */

const capabilities = [
  ['Gmail', 'Send emails, create drafts, read & search messages, reply to threads'],
  ['Calendar', 'Create events (with Google Meet), list upcoming events, update & cancel events'],
  ['Drive', 'Search files, read documents, create Google Docs & Sheets, share files'],
  ['Tasks', 'Create to-do items, list tasks, mark complete, delete tasks'],
  ['Forms', 'Create forms with questions, read form responses'],
  ['Contacts', 'Look up team members by email, list directory users, find birthdays'],
];

const apis = [
  ['Gmail API', 'Email sending, reading, drafts'],
  ['Google Calendar API', 'Event management'],
  ['Google Drive API', 'File search, reading, creation'],
  ['Google Tasks API', 'Task management'],
  ['Google Forms API', 'Form creation and responses'],
  ['Admin SDK API', 'Directory / contacts lookup'],
  ['Google Sheets API', 'Spreadsheet reading'],
  ['People API', 'Contact details, birthdays'],
];

/* ─── Page ─── */

export default function GoogleWorkspacePage() {
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
        <div className="mb-3 inline-flex ml-3 items-center gap-2 rounded-full border border-[#4285F4]/30 bg-[#4285F4]/10 px-3 py-1 text-xs font-medium text-[#4285F4]">
          ~20 min setup
        </div>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">
          Connect Google Workspace
        </h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Give Sandra access to your organization&rsquo;s Gmail, Calendar, Drive, Tasks, Forms, and
          Contacts. This is the most impactful integration.
        </p>
      </div>

      {/* What Sandra can do */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          What Sandra can do with Google Workspace
        </h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Service
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Capabilities
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {capabilities.map(([svc, caps]) => (
                <tr key={svc}>
                  <td className="px-4 py-2.5 font-medium text-on-surface">{svc}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{caps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Prerequisites */}
      <Callout>
        <strong>Prerequisites:</strong> Google Workspace admin access (Super Admin), Google Cloud
        Console access, and Sandra Admin Portal access.
      </Callout>

      {/* Step 1 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">1. Create a Google Cloud project</h2>
        <div className="space-y-3">
          <Step n={1}>
            Go to{' '}
            <a
              href="https://console.cloud.google.com"
              className="text-primary underline"
              target="_blank"
              rel="noopener"
            >
              Google Cloud Console
            </a>
          </Step>
          <Step n={2}>
            Click the <strong>project selector</strong> → <strong>New Project</strong>
          </Step>
          <Step n={3}>
            Name it <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">Sandra AI Assistant</code>,
            select your organization, and click <strong>Create</strong>
          </Step>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">2. Enable required APIs</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          In your Cloud project, go to <strong>APIs &amp; Services → Library</strong> and enable
          each of these:
        </p>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  API
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Required for
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {apis.map(([api, desc]) => (
                <tr key={api}>
                  <td className="px-4 py-2.5 font-medium text-on-surface">{api}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">3. Create a service account</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          Sandra uses a <strong>service account</strong> to access your Workspace. No individual
          user sign-in needed.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Go to <strong>APIs &amp; Services → Credentials</strong>
          </Step>
          <Step n={2}>
            Click <strong>+ Create Credentials → Service Account</strong>
          </Step>
          <Step n={3}>
            Name: <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">Sandra AI</code>,
            ID: <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">sandra-ai</code>
          </Step>
          <Step n={4}>
            Click <strong>Create and Continue</strong> → skip optional steps → <strong>Done</strong>
          </Step>
        </div>

        <h3 className="mb-2 mt-6 text-sm font-bold text-white">Download the key file</h3>
        <div className="space-y-3">
          <Step n={5}>
            Click on your new service account → <strong>Keys</strong> tab →{' '}
            <strong>Add Key → Create new key</strong>
          </Step>
          <Step n={6}>
            Select <strong>JSON</strong> format → <strong>Create</strong>. A{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">.json</code>{' '}
            file downloads.
          </Step>
        </div>
        <Callout type="warn">
          <strong>⚠️ Keep this file safe!</strong> It contains the private key. You&rsquo;ll upload it to
          Sandra later. Note the <code className="rounded bg-white/[0.07] px-1 text-xs">client_id</code>{' '}
          value — you need it in the next step.
        </Callout>
      </section>

      {/* Step 4 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">4. Set up domain-wide delegation</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          This authorizes your service account to act on behalf of users in your Workspace domain.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Go to{' '}
            <a
              href="https://admin.google.com"
              className="text-primary underline"
              target="_blank"
              rel="noopener"
            >
              Google Workspace Admin Console
            </a>
          </Step>
          <Step n={2}>
            Navigate to <strong>Security → Access and data control → API controls</strong>
          </Step>
          <Step n={3}>
            Click <strong>Manage Domain Wide Delegation → Add new</strong>
          </Step>
          <Step n={4}>
            Enter the{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">client_id</code>{' '}
            from your service account JSON (numeric, e.g.{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              123456789
            </code>
            )
          </Step>
          <Step n={5}>
            Paste the full OAuth scopes list below → click <strong>Authorize</strong>
          </Step>
        </div>

        <h3 className="mb-2 mt-6 text-sm font-bold text-white">Required OAuth scopes</h3>
        <p className="mb-2 text-xs text-on-surface-variant">
          Copy this entire comma-separated list:
        </p>
        <CodeBlock lang="text" code={fullScopeList} />
      </section>

      {/* Step 5 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">5. Configure Sandra</h2>
        <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
          Bring the credentials into Sandra via environment variables or the Admin Portal.
        </p>

        <h3 className="mb-2 text-sm font-bold text-white">Option A: Environment variables</h3>
        <CodeBlock
          lang="bash"
          code={`# Entire JSON key file, base64 encoded:
GOOGLE_SA_KEY_JSON=$(cat your-service-account-key.json | base64)

# Your Workspace domain
GOOGLE_WORKSPACE_DOMAIN=yourcompany.com

# Admin email (for directory lookups)
GOOGLE_ADMIN_EMAIL=admin@yourcompany.com

# Sandra's email (for sending)
GOOGLE_DRIVE_IMPERSONATE_EMAIL=sandra@yourcompany.com

# Optional: specific Drive folder IDs
GOOGLE_DRIVE_FOLDER_IDS=folder-id-1,folder-id-2`}
        />

        <h3 className="mb-2 mt-6 text-sm font-bold text-white">Option B: Admin Portal</h3>
        <div className="space-y-3">
          <Step n={1}>
            Log in to the Admin Portal → <strong>Settings</strong> tab
          </Step>
          <Step n={2}>
            Under <strong>Google Workspace Connection</strong>: upload or paste the service account
            JSON key, enter your domain, admin email, and Sandra&rsquo;s email
          </Step>
          <Step n={3}>
            Click <strong>Save</strong> → <strong>Test Connection</strong>
          </Step>
        </div>
      </section>

      {/* Step 6 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">6. Verify the connection</h2>
        <div className="space-y-3">
          <Step n={1}>
            In the Admin Portal, go to <strong>Dashboard → System</strong> and check for a green
            indicator next to Google Workspace
          </Step>
          <Step n={2}>
            In the Sandra chat, try:{' '}
            <em>&ldquo;What meetings do I have this week?&rdquo;</em>
          </Step>
          <Step n={3}>
            Or: <em>&ldquo;Search my Drive for the quarterly report&rdquo;</em>
          </Step>
        </div>
      </section>

      {/* Scopes reference */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          Scope reference
        </h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Scope
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Level
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Why needed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {scopes.map(([scope, level, why]) => (
                <tr key={scope}>
                  <td className="px-4 py-2.5 font-mono text-xs text-on-surface">{scope}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{level}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Troubleshooting</h2>
        <div className="space-y-4">
          {[
            [
              'Insufficient permissions',
              'Go back to the Workspace Admin Console and verify the scopes are correctly configured for the numeric client_id.',
            ],
            [
              'Token exchange failed',
              'Ensure the full JSON key file was uploaded correctly. If you rotated the key in Cloud Console, generate a new one.',
            ],
            [
              'User not found',
              'The configured admin email must be a real Super Admin in your Workspace.',
            ],
            [
              'Sandra can\u2019t find Drive files',
              'Trigger reindexing from Dashboard → System. If you specified folder IDs, verify they are correct.',
            ],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
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
          <li>• Service account JSON key is <strong className="text-on-surface">encrypted at rest</strong></li>
          <li>• Access tokens are short-lived (1 hour) and automatically refreshed</li>
          <li>• Sandra accesses Workspace via impersonation of a designated admin user</li>
          <li>• Revoke access anytime by deleting the key or removing Domain-Wide Delegation</li>
        </ul>
      </section>

      {/* Footer nav */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/admin/zoom"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Connect Zoom &rarr;</p>
          <p className="text-xs text-on-surface-variant">Schedule meetings automatically.</p>
        </Link>
        <Link
          href="/docs/admin/agent-settings"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Agent Settings &rarr;</p>
          <p className="text-xs text-on-surface-variant">Customize Sandra&rsquo;s email behavior.</p>
        </Link>
      </section>
    </div>
  );
}
