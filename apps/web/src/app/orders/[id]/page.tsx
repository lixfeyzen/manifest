import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError } from '@/components/ApiError';
import { AutoRefresh } from '@/components/AutoRefresh';
import { CopyButton } from '@/components/CopyButton';
import { JobStatusBadge, StatusBadge } from '@/components/StatusBadge';
import {
  formatCurrency,
  formatCustomerName,
  formatDateTime,
  formatRelative,
  shortId,
} from '@/lib/format';
import { fetchOrder } from '@/lib/queries.server';
import { OrderActions } from './OrderActions';
import { StatusStepper } from './StatusStepper';
import { Timeline } from './Timeline';

export const dynamic = 'force-dynamic';

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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/orders" className="text-sm text-brand-muted transition-colors hover:text-brand-ink">
          ← Orders
        </Link>
        <AutoRefresh />
      </div>

      {/* Header — flat, hierarchy from type + space */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-mono text-xl font-semibold tracking-tight text-brand-ink">
                {shortId(order.id)}
              </h1>
              <CopyButton value={order.id} ariaLabel="Copy order id" />
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-1.5 text-sm font-medium text-brand-ink">
              {formatCustomerName(order.customerEmail)}
            </p>
            <p className="text-sm text-brand-muted">
              {order.customerEmail} ·{' '}
              <span title={formatDateTime(order.createdAt)}>created {formatRelative(order.createdAt)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-brand-muted">Total</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-brand-ink">
              {formatCurrency(order.totalAmount)}
            </p>
          </div>
        </div>

        <div className="mt-7">
          <StatusStepper status={order.status} />
        </div>

        <div className="mt-7">
          <OrderActions orderId={order.id} amount={order.totalAmount} status={order.status} />
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Items */}
          <Section title="Items">
            <div className="divide-y divide-brand-border border-t border-brand-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-ink">{item.name}</p>
                    <p className="font-mono text-xs text-brand-muted">{item.sku}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm tabular-nums">
                    <span className="text-brand-muted">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </span>
                    <span className="w-28 text-right font-medium text-brand-ink">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-brand-muted">Total</span>
                <span className="text-base font-semibold tabular-nums text-brand-ink">
                  {formatCurrency(order.totalAmount)}
                </span>
              </div>
            </div>
          </Section>

          {/* Payment & Invoice */}
          <div className="grid gap-8 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-brand-border">
            <div className="sm:pr-8">
              <Eyebrow>Payment</Eyebrow>
              {order.payment ? (
                <dl className="mt-4 space-y-2.5 text-sm">
                  <Row label="Status" value={order.payment.status} />
                  <Row label="Amount" value={formatCurrency(order.payment.amount)} />
                  <Row label="Event id" value={order.payment.providerEventId} mono />
                  <Row label="Received" value={formatRelative(order.payment.createdAt)} />
                </dl>
              ) : (
                <Empty>Awaiting payment webhook.</Empty>
              )}
            </div>
            <div className="sm:pl-8">
              <Eyebrow>Invoice</Eyebrow>
              {order.invoice ? (
                <dl className="mt-4 space-y-2.5 text-sm">
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

          {/* Fulfillment */}
          <Section title="Fulfillment">
            {latestJob ? (
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-brand-muted">Status</dt>
                  <dd>
                    <JobStatusBadge status={latestJob.status} />
                  </dd>
                </div>
                <Row label="Attempts" value={String(latestJob.attempts)} />
                {latestJob.lastError && (
                  <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-700">
                    {latestJob.lastError}
                  </div>
                )}
                <Row label="Updated" value={formatRelative(latestJob.updatedAt)} />
              </dl>
            ) : (
              <Empty>No fulfillment job yet — created after payment.</Empty>
            )}
          </Section>
        </div>

        {/* Activity — the one framed block */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm">
          <Eyebrow>Activity</Eyebrow>
          <div className="mt-4">
            <Timeline events={order.events} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <Eyebrow>{title}</Eyebrow>
      <div className="mt-2">{children}</div>
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
