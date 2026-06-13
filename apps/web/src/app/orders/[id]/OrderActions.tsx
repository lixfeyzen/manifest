'use client';

import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buttonStyles } from '@/components/Button';
import { retryFulfillment, sendPaymentWebhook } from '@/lib/queries';
import type { OrderStatus } from '@/lib/types';

type ToastKind = 'ok' | 'info' | 'err';
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  leaving?: boolean;
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
    // Keep the toast fully readable for 4.5s (E2E asserts "ignored"/"FULFILLED"),
    // then animate out and unmount.
    setTimeout(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 160);
    }, 4500);
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
              return { kind: 'ok', text: `Webhook ${res.status}: ${res.message}` };
            })
          }
          className={`${buttonStyles('primary')} active:scale-[0.98]`}
        >
          {busy === 'pay' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Send test payment
        </button>

        <button
          disabled={canPay || isBusy}
          onClick={() =>
            run('dup', async () => {
              const res = await sendPaymentWebhook({ orderId, amount, duplicate: true });
              return {
                kind: res.status === 'ignored' ? 'info' : 'ok',
                text: `Duplicate webhook ${res.status}: ${res.message}`,
              };
            })
          }
          className={`${buttonStyles('secondary')} active:scale-[0.98]`}
        >
          {busy === 'dup' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Resend payment (duplicate)
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
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium transition-colors active:scale-[0.98] text-amber-700 hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'retry' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Retry fulfillment
          </button>
        )}
      </div>

      {/* Toasts */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2"
      >
        {toasts.map((t) => {
          const Icon = t.kind === 'ok' ? CheckCircle2 : t.kind === 'info' ? Info : AlertCircle;
          const color =
            t.kind === 'ok'
              ? 'text-emerald-600'
              : t.kind === 'info'
                ? 'text-brand-primary'
                : 'text-red-600';
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border border-brand-border bg-brand-surface p-3 shadow-md ${
                t.leaving
                  ? 'translate-y-1 opacity-0 transition-all duration-150 ease-[var(--ease-std)]'
                  : 'mf-toast-in'
              }`}
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
