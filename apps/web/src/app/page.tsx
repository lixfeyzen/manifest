import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Layers } from 'lucide-react';
import { AutoRefresh } from '@/components/AutoRefresh';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDateTime, shortId } from '@/lib/format';
import { fetchDashboardMetrics, fetchOrders } from '@/lib/queries';
import { ApiError } from '@/components/ApiError';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  try {
    const [metrics, orders] = await Promise.all([fetchDashboardMetrics(), fetchOrders()]);
    const recent = orders.slice(0, 5);

    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-brand-ink">Dashboard</h1>
            <p className="mt-1 text-sm text-brand-muted">
              Track every order from payment webhook to fulfillment.
            </p>
          </div>
          <AutoRefresh />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <MetricCard label="Total orders" value={metrics.totalOrders} icon={Layers} accent="ink" />
          <MetricCard label="Pending" value={metrics.pendingOrders} icon={Clock} accent="muted" />
          <MetricCard label="Paid" value={metrics.paidOrders} icon={CreditCard} accent="primary" />
          <MetricCard
            label="Fulfilled"
            value={metrics.fulfilledOrders}
            icon={CheckCircle2}
            accent="emerald"
          />
          <MetricCard
            label="Failed jobs"
            value={metrics.failedJobs}
            icon={AlertTriangle}
            accent="red"
          />
        </div>

        <div className="rounded-xl border border-brand-border bg-brand-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
            <h2 className="text-sm font-semibold text-brand-ink">Recent orders</h2>
            <Link href="/orders" className="text-sm font-medium text-brand-primary hover:text-brand-primary-dark">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-brand-muted">
              No orders yet.{' '}
              <Link href="/orders/new" className="font-medium text-brand-primary">
                Create your first order
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-brand-border">
              {recent.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-brand-surface-2"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-brand-ink">{shortId(order.id)}</p>
                      <p className="truncate text-xs text-brand-muted">{order.customerEmail}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm tabular-nums text-brand-ink">
                        {formatCurrency(order.totalAmount)}
                      </span>
                      <StatusBadge status={order.status} />
                      <span className="hidden text-xs text-brand-muted sm:block">
                        {formatDateTime(order.createdAt)}
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
