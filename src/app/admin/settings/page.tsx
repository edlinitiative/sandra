import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AgentConfigSettings } from '@/components/admin/agent-config-settings';

export default async function SettingsPage() {
  const session = await auth();

  if (!session) {
    redirect('/login?callbackUrl=/admin/settings');
  }

  if (session.user.role !== 'admin') {
    redirect('/?error=unauthorized');
  }

  return <AgentConfigSettings />;
}
