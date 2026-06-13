import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError } from '@/components/ApiError';
import { AutoRefresh } from '@/components/AutoRefresh';
import { buttonStyles } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { eventMeta } from '@/lib/events';
import {
  formatCurrency,
  formatCustomerName,
  formatDateTime,
  formatRelative,
  formatStatus,
  shortId,
} from '@/lib/format';
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
  searchParams: Promise<{ status?: string; limit?: string }>;
}) {
  const { status, limit: limitParam } = await searchParams;
  const active = (STATUSES.includes(status as OrderStatus) ? status : 'ALL') as OrderStatus | 'ALL';
  const limit = Math.min(Math.max(Number(limitParam) || 50, 50), 100);

  try {
    const orders = await fetchOrders(active === 'ALL' ? undefined : active, limit);
    const hasMore = orders.length === limit && limit < 100;
    const moreHref = `/orders?${active !== 'ALL' ? `status=${active}&` : ''}limit=${Math.min(limit + 50, 100)}`;

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">Orders</h1>
            <AutoRefresh />
          </div>
          <Link href="/orders/new" className={buttonStyles('primary')}>
            New order
          </Link>
        </div>

        {/* Filter: minimal text tabs */}
        <div className="flex flex-wrap gap-5 border-b border-brand-border text-sm">
          {STATUSES.map((s) => {
            const href = s === 'ALL' ? '/orders' : `/orders?status=${s}`;
            const isActive = active === s;
            return (
              <Link
                key={s}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`-mb-px border-b-2 pb-2 transition-colors ${
                  isActive
                    ? 'border-brand-primary text-brand-ink'
                    : 'border-transparent text-brand-muted hover:text-brand-ink'
                }`}
              >
                {formatStatus(s)}
              </Link>
            );
          })}
        </div>

        {orders.length === 0 ? (
          <p className="py-16 text-center text-sm text-brand-muted">
            {active === 'ALL' ? (
              <>
                No orders yet.{' '}
                <Link href="/orders/new" className="text-brand-primary">
                  Add a manual order
                </Link>
                .
              </>
            ) : (
              <>
                No {formatStatus(active).toLowerCase()} orders.{' '}
                <Link href="/orders" className="text-brand-primary">
                  Clear filter
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <table className="w-full min-w-[640px] text-sm">
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
                  <tr key={order.id} className="transition-colors hover:bg-brand-surface-2">
                    <td className="py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono text-brand-ink hover:text-brand-primary"
                      >
                        {shortId(order.id)}
                      </Link>
                    </td>
                    <td className="py-3">
                      <div className="leading-tight">
                        <p className="text-brand-ink">{formatCustomerName(order.customerEmail)}</p>
                        <p className="text-xs text-brand-muted">{order.customerEmail}</p>
                      </div>
                    </td>
                    <td className="py-3 text-right tabular-nums text-brand-ink">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3">
                      {order.lastEvent ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-brand-muted">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${eventMeta(order.lastEvent.type).dot}`}
                          />
                          {eventMeta(order.lastEvent.type).label}
                        </span>
                      ) : (
                        <span className="text-xs text-brand-muted">-</span>
                      )}
                    </td>
                    <td className="py-3 text-right text-xs text-brand-muted">
                      <span title={formatDateTime(order.createdAt)}>
                        {formatRelative(order.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center">
            <Link href={moreHref} className={buttonStyles('secondary')}>
              Show more
            </Link>
          </div>
        )}
      </div>
    );
  } catch (error) {
    if ((error as { status?: number })?.status === 401) redirect('/login');
    return <ApiError error={error} />;
  }
}
