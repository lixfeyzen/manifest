'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input, Label } from '@/components/Field';
import { Wordmark } from '@/components/Logo';
import { login } from '@/lib/queries';

export default function LoginPage() {
  const router = useRouter();
  // Demo account is intentionally public (seeded, documented in the README), so the
  // form starts pre-filled, a recruiter can sign in with a single click.
  const [email, setEmail] = useState('demo@manifest.dev');
  const [password, setPassword] = useState('demo12345');
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
      <div className="mb-6 flex justify-center">
        <Wordmark subtitle="Fulfillment Operations" />
      </div>
      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-tight text-brand-ink">Operator sign-in</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Internal console for the team that fulfills orders.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
