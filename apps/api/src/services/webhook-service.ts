import { Prisma, prisma } from '@manifest/db';
import {
  OrderNotFoundError,
  WEBHOOK_IGNORED,
  WEBHOOK_PROCESSED,
  type WebhookResult,
  assertPaymentCoversOrder,
  assertTransition,
  decideIdempotency,
} from '@manifest/domain';
import {
  FulfillmentJobStatus,
  OrderEventType,
  OrderStatus,
  PaymentStatus,
  ProcessedEventStatus,
  fulfillmentJobId,
  type PaymentWebhookInput,
} from '@manifest/shared';
import { withCorrelation } from '../logger.js';
import { enqueueFulfillment } from './fulfillment-service.js';
import { writeEvent } from './event-service.js';

/**
 * Process an incoming payment webhook (Flow 2).
 *
 * The reliability core of the whole project lives here:
 *  - A ProcessedEvent row keyed by idempotencyKey makes processing exactly-once.
 *  - The Payment/Order/job writes happen in ONE transaction so a partial failure
 *    can never leave an order "paid" with no payment record (or vice versa).
 *  - The slow part (fulfillment) is pushed to a queue, so the webhook returns fast.
 *
 * A duplicate webhook (same idempotencyKey) returns "ignored" and changes nothing:
 * no second payment, no second job, no second invoice downstream.
 */
export async function processPaymentWebhook(input: PaymentWebhookInput): Promise<WebhookResult> {
  const log = withCorrelation(input.correlationId);

  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) {
    throw new OrderNotFoundError(input.orderId);
  }

  // The payment must cover the server-priced order total (orders are priced from
  // inventory at creation, never by the caller). An underpaid or zero-amount webhook is
  // refused here rather than shipping full goods and booking a full-value invoice.
  assertPaymentCoversOrder(input.amount, order.totalAmount);

  // Idempotency gate: have we already processed this exact event?
  const existing = await prisma.processedEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  const decision = decideIdempotency(existing?.status);

  if (decision.kind === 'ignore') {
    log.info({ reason: decision.reason }, 'Duplicate payment webhook ignored');
    await writeEvent(prisma, {
      orderId: order.id,
      type: OrderEventType.DUPLICATE_EVENT_IGNORED,
      correlationId: input.correlationId,
      payload: { idempotencyKey: input.idempotencyKey, reason: decision.reason },
    });
    return WEBHOOK_IGNORED;
  }

  // A genuinely new event (fresh idempotencyKey) for an order that is already past
  // PENDING — e.g. a provider re-notification under a new key. The order is already
  // settled, so record it and return ignored (2xx) instead of letting the PENDING->PAID
  // transition throw and surface to the provider as a retryable 500.
  if (order.status !== OrderStatus.PENDING) {
    log.info({ status: order.status }, 'Payment for already-settled order ignored');
    await writeEvent(prisma, {
      orderId: order.id,
      type: OrderEventType.DUPLICATE_EVENT_IGNORED,
      correlationId: input.correlationId,
      payload: { idempotencyKey: input.idempotencyKey, reason: 'already_settled' },
    });
    return WEBHOOK_IGNORED;
  }

  // New event: do the core state change atomically.
  const jobId = fulfillmentJobId(order.id);
  try {
    await prisma.$transaction(async (tx) => {
      // Claim this event first. The unique constraint on idempotencyKey means a
      // concurrent duplicate request will fail here (P2002) and be treated as a
      // duplicate below: this is what makes the gate race-safe.
      await tx.processedEvent.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          providerEventId: input.eventId,
          status: ProcessedEventStatus.PROCESSING,
        },
      });

      // Record receipt as part of the same atomic claim. Writing it here (rather than
      // before the idempotency gate) means a replayed duplicate no longer appends a
      // fresh RECEIVED row, and a concurrent loser's RECEIVED rolls back with its tx.
      await writeEvent(tx, {
        orderId: order.id,
        type: OrderEventType.PAYMENT_WEBHOOK_RECEIVED,
        correlationId: input.correlationId,
        payload: {
          eventId: input.eventId,
          idempotencyKey: input.idempotencyKey,
          amount: input.amount,
        },
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          providerEventId: input.eventId,
          idempotencyKey: input.idempotencyKey,
          amount: input.amount,
          status: PaymentStatus.SUCCEEDED,
          rawPayload: input as unknown as Prisma.InputJsonValue,
        },
      });

      // PENDING -> PAID, validated by the domain state machine.
      await tx.order.update({
        where: { id: order.id },
        data: { status: assertTransition(order.status as OrderStatus, OrderStatus.PAID) },
      });

      await writeEvent(tx, {
        orderId: order.id,
        type: OrderEventType.PAYMENT_SUCCEEDED,
        correlationId: input.correlationId,
        payload: { amount: input.amount },
      });

      await tx.fulfillmentJob.create({
        data: { orderId: order.id, status: FulfillmentJobStatus.QUEUED, bullJobId: jobId },
      });
    });
  } catch (error) {
    // A concurrent duplicate lost the race to create the ProcessedEvent.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      log.info('Concurrent duplicate webhook ignored (unique constraint)');
      await writeEvent(prisma, {
        orderId: order.id,
        type: OrderEventType.DUPLICATE_EVENT_IGNORED,
        correlationId: input.correlationId,
        payload: { idempotencyKey: input.idempotencyKey, reason: 'concurrent' },
      });
      return WEBHOOK_IGNORED;
    }
    throw error;
  }

  // Transaction committed. Now enqueue the async work and finalize.
  await enqueueFulfillment(order.id, input.correlationId, jobId);

  await writeEvent(prisma, {
    orderId: order.id,
    type: OrderEventType.FULFILLMENT_QUEUED,
    correlationId: input.correlationId,
    payload: { jobId },
  });

  await prisma.processedEvent.update({
    where: { idempotencyKey: input.idempotencyKey },
    data: {
      status: ProcessedEventStatus.PROCESSED,
      result: WEBHOOK_PROCESSED as unknown as Prisma.InputJsonValue,
    },
  });

  log.info({ orderId: order.id }, 'Payment webhook processed; fulfillment queued');
  return WEBHOOK_PROCESSED;
}
