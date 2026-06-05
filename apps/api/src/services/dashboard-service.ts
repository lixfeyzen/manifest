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
