import { prisma } from '@manifest/db';
import { FulfillmentJobStatus, OrderStatus } from '@manifest/shared';

export interface DashboardMetrics {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  fulfilledOrders: number;
  failedJobs: number;
}

/**
 * Aggregate counts for the dashboard. Each count is a cheap COUNT query; running
 * them together with Promise.all keeps the dashboard load to a single round-trip
 * of parallel queries.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [totalOrders, pendingOrders, paidOrders, fulfilledOrders, failedJobs] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: OrderStatus.PENDING } }),
    prisma.order.count({ where: { status: OrderStatus.PAID } }),
    prisma.order.count({ where: { status: OrderStatus.FULFILLED } }),
    prisma.fulfillmentJob.count({ where: { status: FulfillmentJobStatus.FAILED } }),
  ]);

  return { totalOrders, pendingOrders, paidOrders, fulfilledOrders, failedJobs };
}

export interface ThroughputDay {
  date: string;
  today: boolean;
  pending: number;
  paid: number;
  fulfilling: number;
  fulfilled: number;
  failed: number;
  total: number;
  hasFailedJob: boolean;
}

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

const segmentOf = (status: string): 'pending' | 'paid' | 'fulfilling' | 'fulfilled' | 'failed' =>
  status === OrderStatus.PENDING
    ? 'pending'
    : status === OrderStatus.PAID
      ? 'paid'
      : status === OrderStatus.FULFILLING
        ? 'fulfilling'
        : status === OrderStatus.FULFILLED
          ? 'fulfilled'
          : 'failed';

/**
 * Per-day order counts (segmented by status) for the throughput chart. Computed in
 * the API by selecting only (createdAt, status) within the window and aggregating
 * in memory — far lighter than shipping every full order to the web layer.
 */
export async function getOrderThroughput(days: number): Promise<ThroughputDay[]> {
  const n = Math.min(Math.max(Math.trunc(days), 1), 90);
  const today = new Date();
  const since = new Date(today);
  since.setDate(today.getDate() - (n - 1));
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, status: true },
  });

  const byDay = new Map<string, ThroughputDay>();
  const todayK = dayKey(today);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const k = dayKey(d);
    byDay.set(k, {
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      today: k === todayK,
      pending: 0,
      paid: 0,
      fulfilling: 0,
      fulfilled: 0,
      failed: 0,
      total: 0,
      hasFailedJob: false,
    });
  }

  for (const row of rows) {
    const bucket = byDay.get(dayKey(new Date(row.createdAt)));
    if (!bucket) continue;
    bucket[segmentOf(row.status)] += 1;
    bucket.total += 1;
    if (row.status === OrderStatus.FAILED) bucket.hasFailedJob = true;
  }

  return [...byDay.values()];
}
