import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  createSessionToken,
  getAuthUser,
  SESSION_COOKIE,
  verifyPassword,
} from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('email' in body) ||
    typeof body.email !== 'string' ||
    !('password' in body) ||
    typeof body.password !== 'string'
  ) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
    return NextResponse.json(
      { error: 'Use the admin sign-in page for this account.' },
      { status: 403 },
    );
  }
  const user = await getAuthUser(email);
  if (!user || !(await verifyPassword(body.password, user.passwordSalt, user.passwordHash))) {
    return NextResponse.json({ error: 'The email or password is incorrect.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return NextResponse.json({ message: 'You are signed in.' });
}
