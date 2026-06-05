import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError } from '@/components/ApiError';
import { AutoRefresh } from '@/components/AutoRefresh';
import { JobStatusBadge, StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDateTime, shortId } from '@/lib/format';
import { fetchOrder } from '@/lib/queries';
import { OrderActions } from './OrderActions';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/orders" className="hover:text-slate-700">
            Orders
          </Link>
          <span>/</span>
          <span className="font-mono text-slate-700">{shortId(order.id)}</span>
        </div>
        <AutoRefresh />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-xl font-semibold text-slate-900">{shortId(order.id)}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{order.customerEmail}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Total</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">
            {formatCurrency(order.totalAmount)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <OrderActions
        orderId={order.id}
        amount={order.totalAmount}
        status={order.status}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: items + payment + invoice + job */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Items">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Unit</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-slate-700">
                      {item.name} <span className="text-slate-400">({item.sku})</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card title="Payment">
              {order.payment ? (
                <dl className="space-y-1.5 text-sm">
                  <Row label="Status" value={order.payment.status} />
                  <Row label="Amount" value={formatCurrency(order.payment.amount)} />
                  <Row label="Event id" value={order.payment.providerEventId} mono />
                  <Row label="Received" value={formatDateTime(order.payment.createdAt)} />
                </dl>
              ) : (
                <Empty>No payment yet. Simulate a webhook above.</Empty>
              )}
            </Card>

            <Card title="Invoice">
              {order.invoice ? (
                <dl className="space-y-1.5 text-sm">
                  <Row label="Number" value={order.invoice.invoiceNumber} mono />
                  <Row label="Amount" value={formatCurrency(order.invoice.amount)} />
                  <Row label="Status" value={order.invoice.status} />
                  <Row label="Issued" value={formatDateTime(order.invoice.createdAt)} />
                </dl>
              ) : (
                <Empty>No invoice yet. Issued during fulfillment.</Empty>
              )}
            </Card>
          </div>

          <Card title="Fulfillment job">
            {latestJob ? (
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <JobStatusBadge status={latestJob.status} />
                  </dd>
                </div>
                <Row label="Attempts" value={String(latestJob.attempts)} />
                {latestJob.lastError && <Row label="Last error" value={latestJob.lastError} />}
                <Row label="Updated" value={formatDateTime(latestJob.updatedAt)} />
              </dl>
            ) : (
              <Empty>No fulfillment job yet. Created after payment.</Empty>
            )}
          </Card>
        </div>

        {/* Right: timeline */}
        <div>
          <Card title="Event timeline">
            <Timeline events={order.events} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400">{children}</p>;
}
