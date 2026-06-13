import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError } from '@/components/ApiError';
import { AutoRefresh } from '@/components/AutoRefresh';
import { Card, CardHeader } from '@/components/Card';
import { MetricCard } from '@/components/MetricCard';
import { OrdersChart } from '@/components/OrdersChart';
import { Reveal } from '@/components/Reveal';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatCustomerName, formatDateTime, formatRelative } from '@/lib/format';
import { fetchDashboardMetrics, fetchOrders, fetchThroughput } from '@/lib/queries.server';

export const dynamic = 'force-dynamic';

const DAYS = 14;

export default async function DashboardPage() {
  try {
    // Three light queries instead of loading the whole orders table: counts, the
    // five most recent orders (slim), and the per-day throughput (aggregated server-side).
    const [metrics, recent, chart] = await Promise.all([
      fetchDashboardMetrics(),
      fetchOrders(undefined, 5),
      fetchThroughput(DAYS),
    ]);

    const newToday = chart.find((d) => d.today)?.total ?? 0;
    const fulfilledPct = metrics.totalOrders
      ? Math.round((metrics.fulfilledOrders / metrics.totalOrders) * 100)
      : 0;

    const cards: Array<{
      label: string;
      value: number;
      icon: LucideIcon;
      hint: { text: string; tone: 'good' | 'bad' | 'muted' };
      alert?: boolean;
    }> = [
      {
        label: 'Total orders',
        value: metrics.totalOrders,
        icon: Layers,
        hint: {
          text: newToday > 0 ? `+${newToday} today` : 'no new today',
          tone: newToday > 0 ? 'good' : 'muted',
        },
      },
      {
        label: 'Pending',
        value: metrics.pendingOrders,
        icon: Clock,
        hint: { text: 'awaiting payment', tone: 'muted' },
      },
      {
        label: 'Paid',
        value: metrics.paidOrders,
        icon: CreditCard,
        hint: { text: 'ready to fulfill', tone: 'muted' },
      },
      {
        label: 'Fulfilled',
        value: metrics.fulfilledOrders,
        icon: CheckCircle2,
        hint: { text: `${fulfilledPct}% of total`, tone: 'muted' },
      },
      {
        label: 'Failed jobs',
        value: metrics.failedJobs,
        icon: AlertTriangle,
        alert: metrics.failedJobs > 0,
        hint:
          metrics.failedJobs > 0
            ? { text: 'needs attention', tone: 'bad' }
            : { text: 'all clear', tone: 'muted' },
      },
    ];

    return (
      <div className="space-y-8">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c, i) => (
            <Reveal key={c.label} delay={i * 40}>
              <MetricCard
                label={c.label}
                value={c.value}
                icon={c.icon}
                hint={c.hint}
                alert={c.alert}
              />
            </Reveal>
          ))}
        </div>

        {/* Chart */}
        <Reveal delay={220}>
          <Card>
            <CardHeader
              title="Throughput"
              action={<span className="text-xs text-brand-muted">Last {DAYS} days</span>}
            />
            <div className="p-5">
              <OrdersChart data={chart} />
            </div>
          </Card>
        </Reveal>

        {/* Recent orders */}
        <Reveal delay={280}>
          <Card>
            <CardHeader
              title="Recent orders"
              action={
                <Link
                  href="/orders"
                  className="text-sm text-brand-muted transition-colors hover:text-brand-ink"
                >
                  View all
                </Link>
              }
            />
            {recent.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-brand-muted">
                No orders yet.{' '}
                <Link href="/orders/new" className="text-brand-primary">
                  Add a manual order
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-brand-border">
                {recent.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="relative flex items-center justify-between px-5 py-3 transition-colors duration-150 hover:bg-brand-surface-2"
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
                        <span
                          title={formatDateTime(order.createdAt)}
                          className="hidden w-20 text-right text-xs text-brand-muted sm:block"
                        >
                          {formatRelative(order.createdAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>
    );
  } catch (error) {
    if ((error as { status?: number })?.status === 401) redirect('/login');
    return <ApiError error={error} />;
  }
}
