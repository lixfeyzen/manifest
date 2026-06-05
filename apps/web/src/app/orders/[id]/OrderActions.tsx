'use client';

import { AlertCircle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { retryFulfillment, sendPaymentWebhook } from '@/lib/queries';
import type { OrderStatus } from '@/lib/types';

type ToastKind = 'ok' | 'info' | 'err';
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  function pushToast(kind: ToastKind, text: string) {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }

  // Refresh now, then again shortly to catch the worker's async result.
  function refreshSoon() {
    startTransition(() => router.refresh());
    setTimeout(() => startTransition(() => router.refresh()), 1500);
  }

  async function run(action: string, fn: () => Promise<{ kind: ToastKind; text: string }>) {
    setBusy(action);
    try {
      const result = await fn();
      pushToast(result.kind, result.text);
      refreshSoon();
    } catch (e) {
      pushToast('err', e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  const canPay = status === 'PENDING';
  const canRetry = status === 'FAILED';
  const isBusy = busy !== null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={!canPay || isBusy}
          onClick={() =>
            run('pay', async () => {
              const res = await sendPaymentWebhook({ orderId, amount });
              return { kind: 'ok', text: `Webhook ${res.status} — ${res.message}` };
            })
          }
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'pay' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Simulate Payment Webhook
        </button>

        <button
          disabled={canPay || isBusy}
          onClick={() =>
            run('dup', async () => {
              const res = await sendPaymentWebhook({ orderId, amount, duplicate: true });
              return {
                kind: res.status === 'ignored' ? 'info' : 'ok',
                text: `Duplicate webhook ${res.status} — ${res.message}`,
              };
            })
          }
          className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'dup' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Simulate Duplicate Webhook
        </button>

        {canRetry && (
          <button
            disabled={isBusy}
            onClick={() =>
              run('retry', async () => {
                const res = await retryFulfillment(orderId);
                return { kind: res.ok ? 'ok' : 'err', text: res.message };
              })
            }
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === 'retry' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Retry Fulfillment
          </button>
        )}
      </div>

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.kind === 'ok' ? CheckCircle2 : t.kind === 'info' ? Info : AlertCircle;
          const color =
            t.kind === 'ok'
              ? 'text-emerald-400'
              : t.kind === 'info'
                ? 'text-brand-primary'
                : 'text-red-400';
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-brand-border bg-brand-surface-2 p-3"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
              <p className="text-sm text-brand-ink">{t.text}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
