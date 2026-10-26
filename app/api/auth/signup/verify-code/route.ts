import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  completeSignup,
  createSessionToken,
  SESSION_COOKIE,
} from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter the verification code from your email.' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('email' in body) ||
    typeof body.email !== 'string' ||
    !('code' in body) ||
    typeof body.code !== 'string' ||
    !/^\d{6}$/.test(body.code)
  ) {
    return NextResponse.json({ error: 'Enter the 6-digit verification code.' }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const result = await completeSignup(email, body.code);
  if (result === 'expired') {
    return NextResponse.json(
      { error: 'That code has expired. Start sign-up again to request another.' },
      { status: 400 },
    );
  }
  if (result === 'locked') {
    return NextResponse.json(
      { error: 'Too many incorrect attempts. Start sign-up again to request a new code.' },
      { status: 429 },
    );
  }
  if (result === 'invalid') {
    return NextResponse.json({ error: 'That code is not correct. Please try again.' }, { status: 400 });
  }
  if (result === 'exists') {
    return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 });
  }
  if (result !== 'verified') {
    throw new Error(`Unexpected signup verification result: ${result}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return NextResponse.json({ message: 'Your email is verified and your account is ready.' });
}
