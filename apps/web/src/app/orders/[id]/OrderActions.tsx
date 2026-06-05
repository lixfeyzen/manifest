'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { retryFulfillment, sendPaymentWebhook } from '@/lib/queries';
import type { OrderStatus } from '@/lib/types';

export function OrderActions({
  orderId,
  amount,
  status,
}: {
  orderId: string;
  amount: number;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'info' | 'err'; text: string } | null>(
    null,
  );

  // Refresh now, then again shortly after to catch the worker's async result.
  function refreshSoon() {
    startTransition(() => router.refresh());
    setTimeout(() => startTransition(() => router.refresh()), 1500);
  }

  async function run(action: string, fn: () => Promise<{ kind: 'ok' | 'info' | 'err'; text: string }>) {
    setBusy(action);
    setMessage(null);
    try {
      setMessage(await fn());
      refreshSoon();
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Action failed' });
    } finally {
      setBusy(null);
    }
  }

  const canPay = status === 'PENDING';
  const canRetry = status === 'FAILED';

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <button
          disabled={!canPay || busy !== null}
          onClick={() =>
            run('pay', async () => {
              const res = await sendPaymentWebhook({ orderId, amount });
              return { kind: 'ok', text: `Webhook ${res.status}: ${res.message}` };
            })
          }
          className="rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'pay' ? 'Sending…' : 'Simulate Payment Webhook'}
        </button>

        <button
          disabled={canPay || busy !== null}
          onClick={() =>
            run('dup', async () => {
              const res = await sendPaymentWebhook({ orderId, amount, duplicate: true });
              return {
                kind: res.status === 'ignored' ? 'info' : 'ok',
                text: `Duplicate webhook → ${res.status}: ${res.message}`,
              };
            })
          }
          className="rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'dup' ? 'Sending…' : 'Simulate Duplicate Webhook'}
        </button>

        <button
          disabled={!canRetry || busy !== null}
          onClick={() =>
            run('retry', async () => {
              const res = await retryFulfillment(orderId);
              return { kind: res.ok ? 'ok' : 'err', text: res.message };
            })
          }
          className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'retry' ? 'Retrying…' : 'Retry Fulfillment'}
        </button>
      </div>

      {message && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ring-1 ring-inset ${
            message.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : message.kind === 'info'
                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                : 'bg-red-50 text-red-700 ring-red-200'
          }`}
        >
          {message.text}
        </p>
      )}

      <p className="mt-3 text-xs text-brand-muted">
        Tip: pay first, then use <strong>Simulate Duplicate</strong> to see the same idempotency key
        safely ignored — no second payment or invoice.
      </p>
    </div>
  );
}
