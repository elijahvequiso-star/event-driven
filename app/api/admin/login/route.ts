import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { adminCredentialsConfigured } from '@/lib/admin-auth';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!adminCredentialsConfigured()) {
    return NextResponse.json({ error: 'Admin login is not configured.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter your admin email and password.' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('email' in body) ||
    typeof body.email !== 'string' ||
    !('password' in body) ||
    typeof body.password !== 'string'
  ) {
    return NextResponse.json({ error: 'Enter your admin email and password.' }, { status: 400 });
  }

  const expectedEmail = process.env.ADMIN_EMAIL!.trim().toLowerCase();
  const providedEmail = body.email.trim().toLowerCase();
  const expectedPasswordHash = createHash('sha256')
    .update(process.env.ADMIN_PASSWORD!)
    .digest();
  const providedPasswordHash = createHash('sha256').update(body.password).digest();
  const passwordMatches = timingSafeEqual(expectedPasswordHash, providedPasswordHash);

  if (providedEmail !== expectedEmail || !passwordMatches) {
    return NextResponse.json({ error: 'The admin email or password is incorrect.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(expectedEmail, 'admin'), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return NextResponse.json({ message: 'Admin signed in.' });
}
