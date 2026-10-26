'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState('');

  const signOut = async () => {
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        setError('We could not sign you out. Please try again.');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('We could not reach the server. Please try again.');
    }
  };

  return (
    <div className="logout-wrap">
      <button className="auth-submit" onClick={signOut} type="button">
        SIGN OUT
      </button>
      {error ? <p aria-live="polite" className="auth-message">{error}</p> : null}
    </div>
  );
}
