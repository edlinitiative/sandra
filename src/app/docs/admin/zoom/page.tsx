import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Connect Zoom — Sandra Admin Guides',
  description:
    'Give Sandra the ability to schedule Zoom meetings via a Server-to-Server OAuth app.',
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

export default function ZoomPage() {
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
        <div className="mb-3 inline-flex ml-3 items-center gap-2 rounded-full border border-[#2D8CFF]/30 bg-[#2D8CFF]/10 px-3 py-1 text-xs font-medium text-[#2D8CFF]">
          ~10 min setup
        </div>
        <h1 className="mb-3 text-3xl font-black tracking-tighter text-white">Connect Zoom</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">
          Give Sandra the ability to schedule Zoom meetings, send invitations, and share join links
          on behalf of your organization.
        </p>
      </div>

      {/* Capabilities */}
      <section className="mb-10">
        <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
          What Sandra can do with Zoom
        </h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Capability
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['Schedule meetings', 'Create meetings with topic, date/time, duration, timezone'],
                ['Invite attendees', 'Automatically add emails as meeting invitees'],
                ['Share join links', 'Provide the meeting join URL and start URL'],
                ['Meeting settings', 'Waiting room, host & participant video enabled by default'],
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
        <strong>Prerequisites:</strong> A Zoom account with admin/developer access, access to the{' '}
        <a
          href="https://marketplace.zoom.us"
          className="text-primary underline"
          target="_blank"
          rel="noopener"
        >
          Zoom App Marketplace
        </a>
        , and Sandra Admin Portal access.
      </Callout>

      {/* Step 1 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">
          1. Create a Server-to-Server OAuth app
        </h2>
        <div className="space-y-3">
          <Step n={1}>
            Go to the{' '}
            <a
              href="https://marketplace.zoom.us"
              className="text-primary underline"
              target="_blank"
              rel="noopener"
            >
              Zoom App Marketplace
            </a>{' '}
            → <strong>Develop</strong> → <strong>Build App</strong>
          </Step>
          <Step n={2}>
            Choose <strong>Server-to-Server OAuth</strong> and click <strong>Create</strong>
          </Step>
          <Step n={3}>
            Name the app{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">Sandra AI</code>
          </Step>
        </div>
        <Callout type="warn">
          <strong>⚠️ Important:</strong> Choose specifically <strong>Server-to-Server OAuth</strong>
          , not &ldquo;OAuth&rdquo; or &ldquo;Webhook Only.&rdquo;
        </Callout>
      </section>

      {/* Step 2 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">2. Copy your credentials</h2>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          On the <strong>App Credentials</strong> page, copy these three values:
        </p>
        <div className="overflow-hidden rounded-xl border border-outline-variant/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Field
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {[
                ['Account ID', 'Your Zoom account identifier'],
                ['Client ID', 'The app\u2019s unique identifier'],
                ['Client Secret', 'The app\u2019s secret key (keep this safe!)'],
              ].map(([field, desc]) => (
                <tr key={field}>
                  <td className="px-4 py-2.5 font-medium text-on-surface">{field}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">3. Add required scopes</h2>
        <div className="space-y-3">
          <Step n={1}>
            In your app settings, go to the <strong>Scopes</strong> tab → <strong>+ Add Scopes</strong>
          </Step>
          <Step n={2}>
            Add:{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              meeting:write:admin
            </code>{' '}
            and{' '}
            <code className="rounded bg-white/[0.07] px-1 text-xs text-on-surface">
              meeting:write
            </code>
          </Step>
          <Step n={3}>
            Click <strong>Done</strong>
          </Step>
        </div>
      </section>

      {/* Step 4 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">4. Activate the app</h2>
        <div className="space-y-3">
          <Step n={1}>
            Go to the <strong>Activation</strong> tab → click <strong>Activate your app</strong>
          </Step>
          <Step n={2}>
            Status should change to <strong className="text-green-400">Active ✓</strong>
          </Step>
        </div>
      </section>

      {/* Step 5 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">5. Configure Sandra</h2>

        <h3 className="mb-2 text-sm font-bold text-white">Option A: Environment variables</h3>
        <CodeBlock
          code={`ZOOM_ACCOUNT_ID=AbCdEfGhIjKlMn
ZOOM_CLIENT_ID=xYzAbCdEfGhIjKl
ZOOM_CLIENT_SECRET=a1b2c3d4e5f6...`}
        />

        <h3 className="mb-2 mt-6 text-sm font-bold text-white">Option B: Admin Portal</h3>
        <div className="space-y-3">
          <Step n={1}>
            Admin Portal → <strong>Settings</strong> → <strong>Zoom Connection</strong>
          </Step>
          <Step n={2}>Enter the Account ID, Client ID, and Client Secret</Step>
          <Step n={3}>
            Click <strong>Save</strong> → <strong>Test Connection</strong>
          </Step>
        </div>
      </section>

      {/* Step 6 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-white">6. Verify</h2>
        <div className="space-y-3">
          <Step n={1}>
            Dashboard → System → check that <strong>Zoom</strong> shows a green indicator
          </Step>
          <Step n={2}>
            In chat, try:{' '}
            <em>&ldquo;Schedule a Zoom meeting for tomorrow at 2pm, 30 minutes&rdquo;</em>
          </Step>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-white">Troubleshooting</h2>
        <div className="space-y-4">
          {[
            [
              'Invalid credentials',
              'Double-check Account ID, Client ID, and Client Secret. Ensure the app is activated.',
            ],
            [
              'Insufficient scopes',
              'Verify both meeting:write:admin and meeting:write scopes are added. You may need to deactivate and reactivate after adding scopes.',
            ],
            [
              'Token errors',
              'If you rotated the Client Secret on Zoom\u2019s side, update it in Sandra.',
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
          <li>• Uses <strong className="text-on-surface">Server-to-Server OAuth</strong> — no user-facing redirects</li>
          <li>• Credentials encrypted at rest; tokens short-lived (1 hour)</li>
          <li>• Only <code className="rounded bg-white/[0.07] px-1">meeting:write</code> scope — cannot read recordings, chats, or other data</li>
          <li>• Revoke access by deactivating the app on marketplace.zoom.us</li>
        </ul>
      </section>

      {/* Footer nav */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/docs/admin/google-workspace"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">&larr; Google Workspace</p>
          <p className="text-xs text-on-surface-variant">Gmail, Calendar, Drive setup.</p>
        </Link>
        <Link
          href="/docs/admin/whatsapp"
          className="flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/30 p-4 text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <p className="mb-1 font-semibold text-white">Connect WhatsApp &rarr;</p>
          <p className="text-xs text-on-surface-variant">Messaging channel setup.</p>
        </Link>
      </section>
    </div>
  );
}
