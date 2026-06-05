import Link from 'next/link';
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
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Track every order from payment webhook to fulfillment.
            </p>
          </div>
          <AutoRefresh />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <MetricCard label="Total orders" value={metrics.totalOrders} />
          <MetricCard label="Pending" value={metrics.pendingOrders} accent="slate" />
          <MetricCard label="Paid" value={metrics.paidOrders} accent="blue" />
          <MetricCard label="Fulfilled" value={metrics.fulfilledOrders} accent="emerald" />
          <MetricCard label="Failed jobs" value={metrics.failedJobs} accent="red" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent orders</h2>
            <Link href="/orders" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No orders yet.{' '}
              <Link href="/orders/new" className="font-medium text-blue-600">
                Create your first order
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-slate-900">{shortId(order.id)}</p>
                      <p className="truncate text-xs text-slate-500">{order.customerEmail}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm tabular-nums text-slate-700">
                        {formatCurrency(order.totalAmount)}
                      </span>
                      <StatusBadge status={order.status} />
                      <span className="hidden text-xs text-slate-400 sm:block">
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
