'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type AuthFormProps = {
  mode: 'login' | 'signup';
  returnTo?: string;
};

export function AuthForm({ mode, returnTo }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'details' | 'verify'>('details');
  const [message, setMessage] = useState('');
  const [adminLoginHint, setAdminLoginHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const destination =
    returnTo?.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\')
      ? returnTo
      : '/#new-in';

  const submitDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setAdminLoginHint(false);
    setBusy(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup/send-code';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login' ? { email, password } : { name, email, password },
        ),
      });
      const result: { message?: string; error?: string } = await response.json();
      if (!response.ok) {
        if (mode === 'login' && response.status === 403) {
          setAdminLoginHint(true);
        }
        setMessage(result.error || 'We could not complete your request. Please try again.');
        return;
      }

      if (mode === 'login') {
        router.push(destination);
        router.refresh();
        return;
      }

      setStage('verify');
      setMessage(result.message || 'Check your inbox for the verification code.');
    } catch {
      setMessage('We could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setBusy(true);

    try {
      const response = await fetch('/api/auth/signup/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const result: { message?: string; error?: string } = await response.json();
      if (!response.ok) {
        setMessage(result.error || 'We could not verify your email. Please try again.');
        return;
      }

      router.push(destination);
      router.refresh();
    } catch {
      setMessage('We could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const isVerifying = mode === 'signup' && stage === 'verify';

  return (
    <main className="auth-page">
      <Link className="wordmark auth-wordmark" href="/">
        MORROW <span>STUDIO</span>
      </Link>
      <section aria-labelledby="auth-title" className="auth-card">
        <p className="eyebrow">{isVerifying ? 'ONE LAST STEP' : 'WELCOME TO MORROW'}</p>
        <h1 id="auth-title">
          {isVerifying
            ? 'Verify your email.'
            : mode === 'login'
              ? 'Welcome back.'
              : 'Create your account.'}
        </h1>
        <p className="auth-description">
          {isVerifying
            ? `Enter the 6-digit code we sent to ${email}. It expires in 10 minutes.`
            : mode === 'login'
              ? 'Sign in to find your way back to the pieces you love.'
              : 'Sign up to make your everyday edit your own.'}
        </p>

        {isVerifying ? (
          <form className="auth-form" onSubmit={verifyEmail}>
            <label htmlFor="verification-code">Email verification code</label>
            <input
              autoComplete="one-time-code"
              autoFocus
              id="verification-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              pattern="\d{6}"
              required
              value={code}
            />
            <button className="auth-submit" disabled={busy || code.length !== 6} type="submit">
              {busy ? 'VERIFYING…' : 'VERIFY EMAIL'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submitDetails}>
            {mode === 'signup' ? (
              <>
                <label htmlFor="auth-name">Your name</label>
                <input
                  autoComplete="name"
                  id="auth-name"
                  maxLength={80}
                  minLength={2}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </>
            ) : null}
            <label htmlFor="auth-email">Email address</label>
            <input
              autoComplete="email"
              id="auth-email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <label htmlFor="auth-password">Password</label>
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              id="auth-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {mode === 'signup' ? (
              <p className="auth-hint">Use at least 8 characters.</p>
            ) : null}
            <button className="auth-submit" disabled={busy} type="submit">
              {busy
                ? mode === 'login'
                  ? 'SIGNING IN…'
                  : 'SENDING CODE…'
                : mode === 'login'
                  ? 'SIGN IN'
                  : 'SEND VERIFICATION CODE'}
            </button>
          </form>
        )}

        {message ? (
          <p aria-live="polite" className="auth-message" role="status">
            {message}
          </p>
        ) : null}
        {adminLoginHint ? (
          <p className="auth-admin-hint">
            <Link href="/admin/login">Go to admin sign in</Link>
          </p>
        ) : null}

        <p className="auth-switch">
          {mode === 'login' ? 'New to Morrow Studio?' : 'Already have an account?'}{' '}
          <Link
            href={`${mode === 'login' ? '/signup' : '/login'}?next=${encodeURIComponent(destination)}`}
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
      </section>
    </main>
  );
}
