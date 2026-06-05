import Link from 'next/link';
import { ApiError } from '@/components/ApiError';
import { AutoRefresh } from '@/components/AutoRefresh';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatRelative, shortId } from '@/lib/format';
import { fetchOrders } from '@/lib/queries.server';
import type { OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: Array<OrderStatus | 'ALL'> = [
  'ALL',
  'PENDING',
  'PAID',
  'FULFILLING',
  'FULFILLED',
  'FAILED',
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = (STATUSES.includes(status as OrderStatus) ? status : 'ALL') as OrderStatus | 'ALL';

  try {
    const orders = await fetchOrders(active === 'ALL' ? undefined : active);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">Orders</h1>
            <AutoRefresh />
          </div>
          <Link
            href="/orders/new"
            className="rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-primary-dark"
          >
            New Order
          </Link>
        </div>

        {/* Filter — minimal text tabs */}
        <div className="flex flex-wrap gap-5 border-b border-brand-border text-sm">
          {STATUSES.map((s) => {
            const href = s === 'ALL' ? '/orders' : `/orders?status=${s}`;
            const isActive = active === s;
            return (
              <Link
                key={s}
                href={href}
                className={`-mb-px border-b-2 pb-2 transition-colors ${
                  isActive
                    ? 'border-brand-primary text-brand-ink'
                    : 'border-transparent text-brand-muted hover:text-brand-ink'
                }`}
              >
                {s}
              </Link>
            );
          })}
        </div>

        {orders.length === 0 ? (
          <p className="py-16 text-center text-sm text-brand-muted">
            No orders found.{' '}
            <Link href="/orders/new" className="text-brand-primary">
              Create a new order
            </Link>
            .
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-brand-border text-left text-xs font-medium uppercase tracking-wide text-brand-muted">
              <tr>
                <th className="py-2 font-medium">Order</th>
                <th className="py-2 font-medium">Customer</th>
                <th className="py-2 text-right font-medium">Total</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Last event</th>
                <th className="py-2 text-right font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-brand-surface-2">
                  <td className="py-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-mono text-brand-ink hover:text-brand-primary"
                    >
                      {shortId(order.id)}
                    </Link>
                  </td>
                  <td className="py-3 text-brand-ink">{order.customerEmail}</td>
                  <td className="py-3 text-right tabular-nums text-brand-ink">
                    {formatCurrency(order.totalAmount)}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3 font-mono text-xs text-brand-muted">
                    {order.lastEvent?.type ?? '—'}
                  </td>
                  <td className="py-3 text-right text-xs text-brand-muted">
                    {formatRelative(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  } catch (error) {
    return <ApiError error={error} />;
  }
}
