import { AlertTriangle, CheckCircle2, Clock, CreditCard, Layers, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError } from '@/components/ApiError';
import { AutoRefresh } from '@/components/AutoRefresh';
import { MetricCard } from '@/components/MetricCard';
import { OrdersChart, type ChartPoint } from '@/components/OrdersChart';
import { Reveal } from '@/components/Reveal';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatCustomerName, formatRelative } from '@/lib/format';
import { fetchDashboardMetrics, fetchOrders } from '@/lib/queries.server';
import type { OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DAYS = 14;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

interface DayAgg {
  pending: number;
  paid: number;
  fulfilling: number;
  fulfilled: number;
  failed: number;
  total: number;
  hasFailedJob: boolean;
}
const emptyDay = (): DayAgg => ({
  pending: 0,
  paid: 0,
  fulfilling: 0,
  fulfilled: 0,
  failed: 0,
  total: 0,
  hasFailedJob: false,
});
const bucketOf = (s: OrderStatus): keyof Omit<DayAgg, 'total' | 'hasFailedJob'> =>
  s === 'PENDING'
    ? 'pending'
    : s === 'PAID'
      ? 'paid'
      : s === 'FULFILLING'
        ? 'fulfilling'
        : s === 'FULFILLED'
          ? 'fulfilled'
          : 'failed';

export default async function DashboardPage() {
  try {
    const [metrics, orders] = await Promise.all([fetchDashboardMetrics(), fetchOrders()]);
    const recent = orders.slice(0, 5);

    // Aggregate real orders per day, segmented by fulfillment stage.
    const byDay = new Map<string, DayAgg>();
    for (const o of orders) {
      const k = dayKey(new Date(o.createdAt));
      const agg = byDay.get(k) ?? emptyDay();
      agg[bucketOf(o.status)] += 1;
      agg.total += 1;
      if (o.status === 'FAILED' || o.fulfillmentJobs.some((j) => j.status === 'FAILED')) {
        agg.hasFailedJob = true;
      }
      byDay.set(k, agg);
    }

    const today = new Date();
    const todayK = dayKey(today);
    const chart: ChartPoint[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dayKey(d);
      const a = byDay.get(k) ?? emptyDay();
      chart.push({
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        today: k === todayK,
        pending: a.pending,
        paid: a.paid,
        fulfilling: a.fulfilling,
        fulfilled: a.fulfilled,
        failed: a.failed,
        total: a.total,
        hasFailedJob: a.hasFailedJob,
      });
    }
    const newToday = byDay.get(todayK)?.total ?? 0;
    const fulfilledPct = metrics.totalOrders
      ? Math.round((metrics.fulfilledOrders / metrics.totalOrders) * 100)
      : 0;

    const cards: Array<{
      label: string;
      value: number;
      icon: LucideIcon;
      tone: 'violet' | 'amber' | 'blue' | 'emerald' | 'red';
      hint?: { text: string; tone: 'good' | 'bad' | 'muted'; dir?: 'up' | 'down' };
    }> = [
      {
        label: 'Total orders',
        value: metrics.totalOrders,
        icon: Layers,
        tone: 'violet',
        hint: {
          text: `${newToday} today`,
          tone: newToday > 0 ? 'good' : 'muted',
          dir: newToday > 0 ? 'up' : undefined,
        },
      },
      { label: 'Pending', value: metrics.pendingOrders, icon: Clock, tone: 'amber' },
      { label: 'Paid', value: metrics.paidOrders, icon: CreditCard, tone: 'blue' },
      {
        label: 'Fulfilled',
        value: metrics.fulfilledOrders,
        icon: CheckCircle2,
        tone: 'emerald',
        hint: { text: `${fulfilledPct}% of total`, tone: 'good' },
      },
      {
        label: 'Failed jobs',
        value: metrics.failedJobs,
        icon: AlertTriangle,
        tone: 'red',
        hint:
          metrics.failedJobs > 0
            ? { text: 'needs attention', tone: 'bad' }
            : { text: 'all clear', tone: 'muted' },
      },
    ];

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
          {cards.map((c, i) => (
            <Reveal key={c.label} delay={i * 40}>
              <MetricCard label={c.label} value={c.value} icon={c.icon} tone={c.tone} hint={c.hint} />
            </Reveal>
          ))}
        </div>

        {/* Chart */}
        <Reveal delay={220}>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-brand-ink">Throughput</h2>
              <p className="text-xs text-brand-muted">Last {DAYS} days</p>
            </div>
            <OrdersChart data={chart} />
          </div>
        </Reveal>

        {/* Recent orders */}
        <Reveal delay={280}>
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
                      className="relative flex items-center justify-between px-5 py-3 transition-colors duration-150 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:origin-center before:scale-y-0 before:bg-brand-primary before:transition-transform before:duration-150 hover:bg-brand-surface-2 hover:before:scale-y-100"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-brand-ink">
                          {formatCustomerName(order.customerEmail)}
                        </p>
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
        </Reveal>
      </div>
    );
  } catch (error) {
    if ((error as { status?: number })?.status === 401) redirect('/login');
    return <ApiError error={error} />;
  }
}
