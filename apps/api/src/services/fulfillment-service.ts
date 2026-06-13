import { prisma } from '@manifest/db';
import { OrderNotFoundError } from '@manifest/domain';
import {
  FULFILLMENT_JOB_OPTIONS,
  FulfillmentJobStatus,
  OrderEventType,
  OrderStatus,
  fulfillmentJobId,
} from '@manifest/shared';
import { randomUUID } from 'node:crypto';
import { fulfillmentQueue } from '../queue.js';
import { writeEvent } from './event-service.js';

/**
 * Add a fulfillment job to the queue. The API only enqueues; apps/worker consumes.
 * `jobId` is deterministic for the first attempt (`fulfillment-<orderId>`), which
 * makes BullMQ deduplicate accidental double-enqueues for the same order.
 */
export async function enqueueFulfillment(
  orderId: string,
  correlationId: string,
  jobId: string,
): Promise<void> {
  await fulfillmentQueue.add(
    'fulfill',
    { orderId, correlationId },
    { jobId, ...FULFILLMENT_JOB_OPTIONS },
  );
}

export interface RetryResult {
  ok: boolean;
  message: string;
  orderId: string;
  status: OrderStatus;
}

/**
 * Manually retry fulfillment for an order (GraphQL mutation).
 *
 * A FULFILLED order is a safe no-op. Otherwise we (re)queue a fulfillment job
 * with a fresh job id: BullMQ will not re-run a completed/failed job that shares
 * the original deterministic id, so the retry needs its own id.
 */
export async function retryFulfillment(orderId: string): Promise<RetryResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  if (order.status === OrderStatus.FULFILLED) {
    return {
      ok: true,
      message: 'Order is already fulfilled; nothing to retry.',
      orderId,
      status: order.status,
    };
  }

  const correlationId = `retry_${randomUUID()}`;
  const retryJobId = `${fulfillmentJobId(orderId)}-retry-${randomUUID()}`;

  await prisma.fulfillmentJob.create({
    data: { orderId, status: FulfillmentJobStatus.QUEUED, bullJobId: retryJobId },
  });

  await enqueueFulfillment(orderId, correlationId, retryJobId);

  await writeEvent(prisma, {
    orderId,
    type: OrderEventType.FULFILLMENT_RETRY_REQUESTED,
    correlationId,
    payload: { retryJobId },
  });

  return {
    ok: true,
    message: 'Fulfillment retry has been queued.',
    orderId,
    status: order.status,
  };
}
