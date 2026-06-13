import type { Queue } from 'bullmq';
import { prisma } from '@manifest/db';
import {
  FULFILLMENT_JOB_OPTIONS,
  FulfillmentJobStatus,
  OrderStatus,
  fulfillmentJobId,
  type FulfillmentJobData,
} from '@manifest/shared';
import { logger } from './logger.js';

// An order counts as "stuck" once it has sat in PAID or FULFILLING longer than this.
export const STUCK_AFTER_MS = 60_000;

/**
 * Crash-gap recovery. Closes the window between the webhook committing (order PAID,
 * FulfillmentJob row QUEUED) and the job actually being enqueued to Redis: if the
 * API died in that gap, the order would be PAID with no BullMQ job and never
 * fulfill. PAID covers that gap; FULFILLING covers a worker crash between phases.
 * runFulfillment is idempotent and decideFulfillment's 'continue' path resumes a
 * FULFILLING order, so re-enqueueing is always safe.
 *
 * The queue is injected rather than module-global so this is unit-testable.
 */
export async function reconcileStuckOrders(queue: Queue<FulfillmentJobData>): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
  const stuck = await prisma.order.findMany({
    where: {
      status: { in: [OrderStatus.PAID, OrderStatus.FULFILLING] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, status: true },
    take: 25,
  });

  for (const o of stuck) {
    // Fresh job id: a stuck FULFILLING order's original deterministic job may be
    // retained as failed/exhausted, so re-adding that id would be deduped away.
    const reconcileJobId = `${fulfillmentJobId(o.id)}-reconcile-${Date.now()}`;
    // Mirror the retry path: create the FulfillmentJob bookkeeping row so the worker
    // can advance it to COMPLETED/FAILED. Without it the order's original row would
    // stay QUEUED forever and the dashboard's job counts would drift from reality.
    await prisma.fulfillmentJob.create({
      data: { orderId: o.id, status: FulfillmentJobStatus.QUEUED, bullJobId: reconcileJobId },
    });
    await queue.add(
      'fulfill',
      { orderId: o.id, correlationId: `reconcile_${o.id}` },
      { jobId: reconcileJobId, ...FULFILLMENT_JOB_OPTIONS },
    );
    logger.warn({ orderId: o.id, status: o.status }, 'Reconciled a stuck order (re-enqueued)');
  }
}
