import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { IntegrationsDashboard } from '@/components/admin/integrations-dashboard';
import { ApiKeysPanel } from '@/components/admin/api-keys-panel';
import { resolveTenantForUser } from '@/lib/google/context';

export default async function IntegrationsPage() {
  const session = await auth();

  if (!session) {
    redirect('/login?callbackUrl=/admin/integrations');
  }

  if (session.user.role !== 'admin') {
    redirect('/?error=unauthorized');
  }

  const tenantId = await resolveTenantForUser(session.user.id);

  return (
    <div className="space-y-12">
      <IntegrationsDashboard tenantId={tenantId ?? undefined} />
      <div className="mx-auto max-w-6xl px-4">
        <div className="border-t border-white/[0.06] pt-10">
          <ApiKeysPanel />
        </div>
      </div>
    </div>
  );
}
