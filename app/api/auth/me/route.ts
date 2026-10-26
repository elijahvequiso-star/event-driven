import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAuthUser, readSessionToken, SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const cookieStore = await cookies();
  const email = readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) {
    return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 });
  }

  const user = await getAuthUser(email);
  if (!user) {
    return NextResponse.json({ error: 'Your account could not be found.' }, { status: 401 });
  }
  return NextResponse.json({ name: user.name, email: user.email });
}
