import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { IntegrationsDashboard } from '@/components/admin/integrations-dashboard';
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

  return <IntegrationsDashboard tenantId={tenantId ?? undefined} />;
}
