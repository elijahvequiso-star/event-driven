import { cookies } from 'next/headers';
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminCredentialsConfigured } from '@/lib/admin-auth';
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
  try {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    let role: 'user' | 'admin' = 'user';
    if (adminEmail && email === adminEmail) {
      if (!adminCredentialsConfigured()) {
        return NextResponse.json({ error: 'Admin login is not configured.' }, { status: 503 });
      }

      const expectedPasswordHash = createHash('sha256')
        .update(process.env.ADMIN_PASSWORD!)
        .digest();
      const providedPasswordHash = createHash('sha256').update(body.password).digest();
      if (!timingSafeEqual(expectedPasswordHash, providedPasswordHash)) {
        return NextResponse.json({ error: 'The email or password is incorrect.' }, { status: 401 });
      }
      role = 'admin';
    } else {
      const user = await getAuthUser(email);
      if (!user) {
        return NextResponse.json(
          { error: 'No verified customer account was found. Sign up and verify your email first.' },
          { status: 401 },
        );
      }
      if (!(await verifyPassword(body.password, user.passwordSalt, user.passwordHash))) {
        return NextResponse.json({ error: 'The email or password is incorrect.' }, { status: 401 });
      }
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createSessionToken(email, role), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({ message: 'You are signed in.', role });
  } catch (error) {
    console.error('Unable to sign in:', error);
    return NextResponse.json(
      { error: 'Sign-in is temporarily unavailable. Check the server logs and Supabase configuration.' },
      { status: 503 },
    );
  }
}
