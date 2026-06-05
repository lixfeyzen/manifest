import Link from 'next/link';
import { ApiError } from '@/components/ApiError';
import { AutoRefresh } from '@/components/AutoRefresh';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatRelative, shortId } from '@/lib/format';
import { fetchDashboardMetrics, fetchOrders } from '@/lib/queries.server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  try {
    const [metrics, orders] = await Promise.all([fetchDashboardMetrics(), fetchOrders()]);
    const recent = orders.slice(0, 5);

    const cells: Array<{ label: string; value: number; accent?: 'ink' | 'red' }> = [
      { label: 'Total orders', value: metrics.totalOrders },
      { label: 'Pending', value: metrics.pendingOrders },
      { label: 'Paid', value: metrics.paidOrders },
      { label: 'Fulfilled', value: metrics.fulfilledOrders },
      { label: 'Failed jobs', value: metrics.failedJobs, accent: 'red' },
    ];

    return (
      <div className="space-y-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">Dashboard</h1>
            <p className="mt-1 text-sm text-brand-muted">
              Track every order from payment webhook to fulfillment.
            </p>
          </div>
          <AutoRefresh />
        </div>

        {/* Metrics — one calm row, hairline-separated, no boxes */}
        <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-0 lg:divide-x lg:divide-brand-border">
          {cells.map((c) => (
            <div key={c.label} className="lg:px-6 lg:first:pl-0">
              <MetricCard label={c.label} value={c.value} accent={c.accent} />
            </div>
          ))}
        </div>

        {/* Recent orders */}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-brand-ink">Recent orders</h2>
            <Link href="/orders" className="text-sm text-brand-primary hover:text-brand-primary-dark">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-10 text-center text-sm text-brand-muted">
              No orders yet.{' '}
              <Link href="/orders/new" className="text-brand-primary">
                Create your first order
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-brand-border border-t border-brand-border">
              {recent.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className="-mx-2 flex items-center justify-between rounded-md px-2 py-3 hover:bg-brand-surface-2"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-brand-ink">{shortId(order.id)}</p>
                      <p className="truncate text-xs text-brand-muted">{order.customerEmail}</p>
                    </div>
                    <div className="flex items-center gap-5">
                      <span className="text-sm tabular-nums text-brand-ink">
                        {formatCurrency(order.totalAmount)}
                      </span>
                      <span className="w-24 text-right">
                        <StatusBadge status={order.status} />
                      </span>
                      <span className="hidden w-20 text-right text-xs text-brand-muted sm:block">
                        {formatRelative(order.createdAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  } catch (error) {
    return <ApiError error={error} />;
  }
}
