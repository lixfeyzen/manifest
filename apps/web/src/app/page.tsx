import Link from 'next/link';
import { ApiError } from '@/components/ApiError';
import { AutoRefresh } from '@/components/AutoRefresh';
import { MetricCard } from '@/components/MetricCard';
import { OrdersChart, type ChartPoint } from '@/components/OrdersChart';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatRelative, shortId } from '@/lib/format';
import { fetchDashboardMetrics, fetchOrders } from '@/lib/queries.server';

export const dynamic = 'force-dynamic';

const DAYS = 14;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export default async function DashboardPage() {
  try {
    const [metrics, orders] = await Promise.all([fetchDashboardMetrics(), fetchOrders()]);
    const recent = orders.slice(0, 5);

    // Build the orders-per-day series + "new today" from real createdAt values.
    const counts = new Map<string, number>();
    for (const o of orders) {
      const k = dayKey(new Date(o.createdAt));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const today = new Date();
    const chart: ChartPoint[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      chart.push({
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        orders: counts.get(dayKey(d)) ?? 0,
      });
    }
    const newToday = counts.get(dayKey(today)) ?? 0;
    const fulfilledPct = metrics.totalOrders
      ? Math.round((metrics.fulfilledOrders / metrics.totalOrders) * 100)
      : 0;

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">Dashboard</h1>
            <p className="mt-1 text-sm text-brand-muted">
              Track every order from payment webhook to fulfillment.
            </p>
          </div>
          <AutoRefresh />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <MetricCard
            label="Total orders"
            value={metrics.totalOrders}
            hint={{
              text: `${newToday} today`,
              tone: newToday > 0 ? 'good' : 'muted',
              dir: newToday > 0 ? 'up' : undefined,
            }}
          />
          <MetricCard
            label="Pending"
            value={metrics.pendingOrders}
            hint={{ text: 'awaiting payment', tone: 'muted' }}
          />
          <MetricCard
            label="Paid"
            value={metrics.paidOrders}
            hint={{ text: 'in fulfillment', tone: 'muted' }}
          />
          <MetricCard
            label="Fulfilled"
            value={metrics.fulfilledOrders}
            hint={{ text: `${fulfilledPct}% of total`, tone: 'good' }}
          />
          <MetricCard
            label="Failed jobs"
            value={metrics.failedJobs}
            hint={
              metrics.failedJobs > 0
                ? { text: 'needs attention', tone: 'bad' }
                : { text: 'all clear', tone: 'muted' }
            }
          />
        </div>

        {/* Chart */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-brand-ink">Orders</h2>
            <p className="text-xs text-brand-muted">New orders per day · last {DAYS} days</p>
          </div>
          <OrdersChart data={chart} />
        </div>

        {/* Recent orders */}
        <div className="rounded-xl border border-brand-border bg-brand-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-brand-border px-5 py-3.5">
            <h2 className="text-sm font-semibold text-brand-ink">Recent orders</h2>
            <Link href="/orders" className="text-sm text-brand-ink hover:text-brand-primary">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-brand-muted">
              No orders yet.{' '}
              <Link href="/orders/new" className="text-brand-primary">
                Create your first order
              </Link>
              .
            </p>
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
