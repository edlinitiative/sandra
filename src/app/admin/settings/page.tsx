import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AgentConfigSettings } from '@/components/admin/agent-config-settings';
import { AiProvidersSettings } from '@/components/admin/ai-providers-settings';

export default async function SettingsPage() {
  const session = await auth();

  if (!session) {
    redirect('/login?callbackUrl=/admin/settings');
  }

  if (session.user.role !== 'admin') {
    redirect('/?error=unauthorized');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 py-2">
      {/* Agent persona & branding */}
      <AgentConfigSettings />

      {/* Divider */}
      <div className="border-t border-outline-variant/15" />

      {/* AI provider keys & fallback */}
      <div>
        <h2 className="mb-1 text-xl font-bold text-white">AI Providers</h2>
        <p className="mb-6 text-sm text-on-surface-variant">
          Manage API keys for the AI models Sandra uses. Keys saved here override environment
          variables — no Vercel redeploy required.
        </p>
        <AiProvidersSettings />
      </div>
    </div>
  );
}
