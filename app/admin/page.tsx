import { redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/admin-dashboard';
import { isAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  let authorized = false;
  try {
    authorized = await isAdminSession();
  } catch (error) {
    console.error('Unable to authorize admin page:', error);
  }

  if (!authorized) {
    redirect(`/login?next=${encodeURIComponent('/admin')}`);
  }

  return <AdminDashboard />;
}
