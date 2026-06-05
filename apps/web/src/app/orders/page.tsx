import Link from 'next/link';
import { ApiError } from '@/components/ApiError';
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
          <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
          <Link
            href="/orders/new"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
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
                    ? 'bg-slate-900 text-white ring-slate-900'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {s}
              </Link>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {orders.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No orders found for this filter.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last event</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono text-blue-600 hover:text-blue-700"
                      >
                        {shortId(order.id)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{order.customerEmail}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {order.lastEvent?.type ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">
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
