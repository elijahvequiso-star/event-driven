import { NextResponse } from 'next/server';
import {
  createOtp,
  hashOtp,
  hashPassword,
  OTP_RESEND_DELAY_MS,
  OTP_LIFETIME_MS,
  getAuthUser,
  getPendingSignup,
  savePendingSignup,
  deletePendingSignup,
  sendSignupCode,
} from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter valid sign-up details.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Enter valid sign-up details.' }, { status: 400 });
  }

  const { name, email, password } = body as Record<string, unknown>;
  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 80 ||
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128
  ) {
    return NextResponse.json(
      { error: 'Enter a name, valid email, and password of at least 8 characters.' },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  try {
    if (normalizedEmail === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
      return NextResponse.json({ error: 'That email address cannot be registered.' }, { status: 409 });
    }
    if (await getAuthUser(normalizedEmail)) {
      return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 });
    }

    const existingSignup = await getPendingSignup(normalizedEmail);
    const now = Date.now();
    if (existingSignup && now - existingSignup.lastSentAt < OTP_RESEND_DELAY_MS) {
      return NextResponse.json(
        { error: 'Please wait a minute before requesting another code.' },
        { status: 429 },
      );
    }

    const { salt, hash } = await hashPassword(password);
    const code = createOtp();
    const pendingSignup = {
      name: name.trim(),
      email: normalizedEmail,
      passwordSalt: salt,
      passwordHash: hash,
      codeHash: hashOtp(code),
      expiresAt: now + OTP_LIFETIME_MS,
      lastSentAt: now,
      attempts: 0,
    };

    await savePendingSignup(pendingSignup);

    try {
      await sendSignupCode(normalizedEmail, pendingSignup.name, code);
    } catch (error) {
      console.error('Unable to send the sign-up verification email:', error);
      await deletePendingSignup(normalizedEmail);
      return NextResponse.json(
        { error: 'We could not send the verification email. Check the SMTP settings and try again.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ message: 'A verification code has been sent to your email.' });
  } catch (error) {
    console.error('Unable to process the sign-up request:', error);
    return NextResponse.json(
      {
        error:
          'Sign-up is temporarily unavailable. Check the Vercel function logs and verify the Supabase environment variables and database schema.',
      },
      { status: 503 },
    );
  }
}
