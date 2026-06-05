'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { login } from '@/lib/queries';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('demo@manifest.dev');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-sm font-bold text-white">
          M
        </span>
        <span className="text-lg font-semibold tracking-tight text-brand-ink">Manifest</span>
      </div>
      <h1 className="text-xl font-semibold text-brand-ink">Sign in</h1>
      <p className="mt-1 text-sm text-brand-muted">Welcome back to fulfillment operations.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-brand-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-brand-ink">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-sm text-brand-muted">
        No account?{' '}
        <Link href="/register" className="text-brand-primary hover:text-brand-primary-dark">
          Create one
        </Link>
      </p>
      <p className="mt-6 rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-muted">
        Demo login — <span className="font-mono text-brand-ink">demo@manifest.dev</span> /{' '}
        <span className="font-mono text-brand-ink">demo12345</span>
      </p>
    </div>
  );
}
