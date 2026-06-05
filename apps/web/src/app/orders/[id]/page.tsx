import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError } from '@/components/ApiError';
import { AutoRefresh } from '@/components/AutoRefresh';
import { CopyButton } from '@/components/CopyButton';
import { formatCurrency, formatDateTime, formatRelative, shortId } from '@/lib/format';
import { fetchOrder } from '@/lib/queries';
import type { FulfillmentJobStatus, OrderStatus } from '@/lib/types';
import { OrderActions } from './OrderActions';
import { StatusStepper } from './StatusStepper';
import { Timeline } from './Timeline';

export const dynamic = 'force-dynamic';

const DOT: Record<string, string> = {
  neutral: 'bg-brand-muted',
  purple: 'bg-brand-primary',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
};

const orderTone = (s: OrderStatus) =>
  s === 'PENDING'
    ? 'neutral'
    : s === 'PAID'
      ? 'purple'
      : s === 'FULFILLING'
        ? 'amber'
        : s === 'FULFILLED'
          ? 'green'
          : 'red';

const jobTone = (s: FulfillmentJobStatus) =>
  s === 'COMPLETED' ? 'green' : s === 'FAILED' ? 'red' : s === 'PROCESSING' ? 'amber' : 'neutral';

function StatusLabel({ label, tone, className = '' }: { label: string; tone: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold text-brand-ink ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      <span>{label}</span>
    </span>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let order;
  try {
    order = await fetchOrder(id);
  } catch (error) {
    return <ApiError error={error} />;
  }
  if (!order) notFound();

  const latestJob = order.fulfillmentJobs[0] ?? null;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-brand-muted transition-colors hover:text-brand-ink"
        >
          <ChevronLeft className="h-4 w-4" />
          Orders
        </Link>
        <AutoRefresh />
      </div>

      {/* Focal header: identity, total, lifecycle, actions */}
      <section className="rounded-xl border border-brand-border bg-brand-surface shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
              Order
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="font-mono text-xl font-semibold tracking-tight text-brand-ink">
                {shortId(order.id)}
              </h1>
              <CopyButton value={order.id} ariaLabel="Copy order id" />
              <StatusLabel label={order.status} tone={orderTone(order.status)} className="text-xs" />
            </div>
            <p className="mt-1.5 text-sm text-brand-muted">
              {order.customerEmail} ·{' '}
              <span title={formatDateTime(order.createdAt)}>
                created {formatRelative(order.createdAt)}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
              Total
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-brand-ink">
              {formatCurrency(order.totalAmount)}
            </p>
          </div>
        </div>

        <div className="border-t border-brand-border px-6 py-5">
          <StatusStepper status={order.status} />
        </div>

        <div className="border-t border-brand-border px-6 py-4">
          <OrderActions orderId={order.id} amount={order.totalAmount} status={order.status} />
        </div>
      </section>

      {/* Detail grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Items */}
          <Panel title="Items">
            <div className="divide-y divide-brand-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-ink">{item.name}</p>
                    <p className="font-mono text-xs text-brand-muted">{item.sku}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm tabular-nums">
                    <span className="text-brand-muted">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </span>
                    <span className="w-24 text-right font-medium text-brand-ink">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-brand-border pt-3">
              <span className="text-sm text-brand-muted">Total</span>
              <span className="text-base font-semibold tabular-nums text-brand-ink">
                {formatCurrency(order.totalAmount)}
              </span>
            </div>
          </Panel>

          {/* Payment & Invoice */}
          <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
            <div className="grid divide-y divide-brand-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-5">
                <Eyebrow>Payment</Eyebrow>
                {order.payment ? (
                  <dl className="mt-3 space-y-2 text-sm">
                    <Row label="Status" value={order.payment.status} />
                    <Row label="Amount" value={formatCurrency(order.payment.amount)} />
                    <Row label="Event id" value={order.payment.providerEventId} mono />
                    <Row label="Received" value={formatRelative(order.payment.createdAt)} />
                  </dl>
                ) : (
                  <Empty>Awaiting payment webhook.</Empty>
                )}
              </div>
              <div className="p-5">
                <Eyebrow>Invoice</Eyebrow>
                {order.invoice ? (
                  <dl className="mt-3 space-y-2 text-sm">
                    <Row label="Number" value={order.invoice.invoiceNumber} mono />
                    <Row label="Amount" value={formatCurrency(order.invoice.amount)} />
                    <Row label="Status" value={order.invoice.status} />
                    <Row label="Issued" value={formatRelative(order.invoice.createdAt)} />
                  </dl>
                ) : (
                  <Empty>Issued during fulfillment.</Empty>
                )}
              </div>
            </div>
          </div>

          {/* Fulfillment */}
          <Panel title="Fulfillment">
            {latestJob ? (
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-brand-muted">Status</dt>
                  <dd>
                    <StatusLabel
                      label={latestJob.status}
                      tone={jobTone(latestJob.status)}
                      className="text-xs"
                    />
                  </dd>
                </div>
                <Row label="Attempts" value={String(latestJob.attempts)} />
                {latestJob.lastError && (
                  <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {latestJob.lastError}
                  </div>
                )}
                <Row label="Updated" value={formatRelative(latestJob.updatedAt)} />
              </dl>
            ) : (
              <Empty>No fulfillment job yet — created after payment.</Empty>
            )}
          </Panel>
        </div>

        {/* Activity */}
        <div>
          <Panel title="Activity">
            <Timeline events={order.events} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-brand-border bg-brand-surface p-5">
      <Eyebrow>{title}</Eyebrow>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">{children}</p>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-brand-muted">{label}</dt>
      <dd className={`text-right text-brand-ink ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-brand-muted">{children}</p>;
}
