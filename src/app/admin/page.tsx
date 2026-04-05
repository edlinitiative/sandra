import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AdminDashboard } from '@/components/admin/admin-dashboard';

export default async function AdminPage() {
  const session = await auth();

  if (!session) {
    redirect('/login?callbackUrl=/admin');
  }

  if (session.user.role !== 'admin') {
    redirect('/?error=unauthorized');
  }

  return <AdminDashboard />;
}
