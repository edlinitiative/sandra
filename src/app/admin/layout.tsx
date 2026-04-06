import { AdminNav } from '@/components/admin/admin-nav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <AdminNav />
      <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
    </div>
  );
}
