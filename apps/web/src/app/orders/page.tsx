import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { ApiError } from '@/components/ApiError';
import { AutoRefresh } from '@/components/AutoRefresh';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDateTime, shortId } from '@/lib/format';
import { fetchOrders } from '@/lib/queries';
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
            <h1 className="text-2xl font-semibold text-brand-ink">Orders</h1>
            <AutoRefresh />
          </div>
          <Link
            href="/orders/new"
            className="rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-primary-dark"
          >
            New Order
          </Link>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => {
            const href = s === 'ALL' ? '/orders' : `/orders?status=${s}`;
            const isActive = active === s;
            return (
              <Link
                key={s}
                href={href}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                  isActive
                    ? 'bg-brand-primary text-white ring-brand-primary'
                    : 'bg-brand-surface text-brand-muted ring-brand-border hover:bg-brand-surface-2'
                }`}
              >
                {s}
              </Link>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-sm">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-bg text-brand-muted">
                <Inbox className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-brand-ink">No orders found</p>
              <p className="text-sm text-brand-muted">
                Try a different filter, or{' '}
                <Link href="/orders/new" className="font-medium text-brand-primary">
                  create a new order
                </Link>
                .
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-brand-border bg-brand-bg text-left text-xs font-medium uppercase tracking-wide text-brand-muted">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last event</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-brand-surface-2">
                    <td className="px-5 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono text-brand-primary hover:text-brand-primary-dark"
                      >
                        {shortId(order.id)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-brand-ink">{order.customerEmail}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-brand-ink">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-brand-muted">
                      {order.lastEvent?.type ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-brand-muted">
                      {formatDateTime(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  } catch (error) {
    return <ApiError error={error} />;
  }
}
