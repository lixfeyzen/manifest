'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Wordmark } from '@/components/Logo';
import { register } from '@/lib/queries';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(email, password);
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex justify-center">
        <Wordmark />
      </div>
      <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-brand-ink">Create account</h1>
        <p className="mt-1 text-sm text-brand-muted">Set up a staff account for the ops console.</p>

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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
          <p className="mt-1 text-xs text-brand-muted">At least 8 characters.</p>
        </div>

        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

        <p className="mt-5 text-sm text-brand-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-ink hover:text-brand-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
