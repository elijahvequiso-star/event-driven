'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error || 'Unable to sign in.');
        return;
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <Link className="wordmark auth-wordmark" href="/">
        MORROW <span>STUDIO</span>
      </Link>
      <section className="auth-card" aria-labelledby="admin-login-title">
        <p className="eyebrow">STORE MANAGEMENT</p>
        <h1 id="admin-login-title">Admin sign in.</h1>
        <p className="auth-description">Sign in to manage the store and customer orders.</p>
        <form className="auth-form" onSubmit={signIn}>
          <label htmlFor="admin-email">Admin email</label>
          <input
            autoComplete="username"
            id="admin-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <label htmlFor="admin-password">Password</label>
          <input
            autoComplete="current-password"
            id="admin-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <button className="auth-submit" disabled={busy} type="submit">
            {busy ? 'SIGNING IN…' : 'SIGN IN TO ADMIN'}
          </button>
        </form>
        {error ? <p aria-live="polite" className="auth-message" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
