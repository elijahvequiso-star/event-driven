import { cookies } from 'next/headers';
import { readAdminSessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function isAdminSession(): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set to enable admin access.');
  }

  const cookieStore = await cookies();
  const email = readAdminSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  return email === adminEmail;
}

export function adminCredentialsConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}
