import { redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/admin-dashboard';
import { isAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  try {
    if (!(await isAdminSession())) redirect('/admin/login');
  } catch (error) {
    console.error('Unable to authorize admin page:', error);
    redirect('/admin/login');
  }
  return <AdminDashboard />;
}
