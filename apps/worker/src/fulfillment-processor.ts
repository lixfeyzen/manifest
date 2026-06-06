import { Prisma, prisma } from '@manifest/db';
import {
  InsufficientStockError,
  assertTransition,
  buildInvoiceNumber,
  decideFulfillment,
  shouldCreateInvoice,
} from '@manifest/domain';
import {
  InvoiceStatus,
  OrderEventType,
  OrderStatus,
  fulfillmentJobDataSchema,
  type FulfillmentJobData,
} from '@manifest/shared';
import { withCorrelation } from './logger.js';
import { writeEvent } from './events.js';

/**
 * Thrown for permanent failures (e.g. insufficient stock) so the caller can stop
 * BullMQ from retrying. Transient failures throw plain Errors, which DO retry.
 */
export class PermanentFulfillmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentFulfillmentError';
  }
}

/**
 * Fulfill an order (Flow 3). Designed to be safe to run MORE THAN ONCE for the
 * same order. It runs as three atomic phases, each wrapping its state change with
 * the timeline event it implies, so the timeline can never disagree with the data
 * even if the process crashes between phases:
 *
 *   1. PAID/FAILED -> FULFILLING  (+ fulfillment.started)
 *   2. reserve inventory          (+ inventory.reserved)
 *   3. issue invoice + FULFILLED  (+ invoice.generated, order.fulfilled)
 *
 * Every side effect is guarded so a retry resumes rather than duplicates:
 *   - the transition only runs when the order still needs it (state machine)
 *   - stock is decremented with an atomic, guarded UPDATE (no oversell, no double)
 *   - a reservation/invoice that already exists is skipped
 */
export async function runFulfillment(rawData: FulfillmentJobData): Promise<void> {
  const { orderId, correlationId } = fulfillmentJobDataSchema.parse(rawData);
  const log = withCorrelation(correlationId);

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) {
    throw new PermanentFulfillmentError(`Order not found: ${orderId}`);
  }

  // Decide what to do based on current status (throws if order is not fulfillable).
  let action;
  try {
    action = decideFulfillment(order.status as OrderStatus);
  } catch (error) {
    throw new PermanentFulfillmentError((error as Error).message);
  }

  if (action.kind === 'noop') {
    log.info({ orderId }, 'Order already fulfilled, no-op');
    return;
  }

  // ---- Phase 1: PAID/FAILED -> FULFILLING (atomic with its event) -----------
  // Skipped on a resumed attempt (status already FULFILLING => 'continue'), so the
  // fulfillment.started event is written at most once.
  if (action.kind === 'start') {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: assertTransition(order.status as OrderStatus, OrderStatus.FULFILLING) },
      });
      await writeEvent(tx, {
        orderId,
        type: OrderEventType.FULFILLMENT_STARTED,
        correlationId,
        payload: { attemptFrom: order.status },
      });
    });
  }

  // ---- Phase 2: reserve inventory (atomic, retry-safe) ----------------------
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryReservation.findMany({
        where: { orderId },
        select: { sku: true },
      });
      const reservedSkus = new Set(existing.map((r) => r.sku));

      for (const item of order.items) {
        // Already reserved on a previous attempt -> skip (no double deduction).
        if (reservedSkus.has(item.sku)) continue;

        // Atomic guarded decrement: succeeds only if enough stock remains. The row
        // lock makes a competing transaction re-check `stock >= quantity` against the
        // committed value, so two orders racing for the same SKU can never oversell.
        const dec = await tx.inventoryItem.updateMany({
          where: { sku: item.sku, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (dec.count === 0) {
          const inv = await tx.inventoryItem.findUnique({ where: { sku: item.sku } });
          throw new InsufficientStockError(item.sku, item.quantity, inv?.stock ?? 0);
        }

        await tx.inventoryReservation.create({
          data: { orderId, sku: item.sku, quantity: item.quantity },
        });
      }

      await writeEvent(tx, {
        orderId,
        type: OrderEventType.INVENTORY_RESERVED,
        correlationId,
        payload: { items: order.items.map((i) => ({ sku: i.sku, quantity: i.quantity })) },
      });
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      // Permanent: mark the order FAILED and stop retrying. markOrderFailed is
      // guarded + atomic, so it is safe that the worker's 'failed' handler also
      // calls it (the second call is a no-op).
      await markOrderFailed(orderId, correlationId, error.message);
      throw new PermanentFulfillmentError(error.message);
    }
    // A concurrent attempt may have created the reservation first (P2002) — the
    // transaction rolled back its own decrement, so a retry will see the reservation
    // and skip it. Re-throw as transient.
    throw error;
  }

  // ---- Phase 3: invoice (once) + finalize to FULFILLED (atomic) -------------
  try {
    await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.invoice.findUnique({ where: { orderId } });
      if (shouldCreateInvoice(existingInvoice?.id)) {
        const invoiceNumber = buildInvoiceNumber(orderId, new Date());
        await tx.invoice.create({
          data: { orderId, invoiceNumber, amount: order.totalAmount, status: InvoiceStatus.ISSUED },
        });
        await writeEvent(tx, {
          orderId,
          type: OrderEventType.INVOICE_GENERATED,
          correlationId,
          payload: { invoiceNumber, amount: order.totalAmount },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: assertTransition(OrderStatus.FULFILLING, OrderStatus.FULFILLED) },
      });
      await writeEvent(tx, { orderId, type: OrderEventType.ORDER_FULFILLED, correlationId });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.invoice.findUnique({ where: { orderId } });
      if (existing) {
        // A concurrent attempt won the finalize for THIS order. Benign: let a retry
        // observe the FULFILLED status and no-op.
        throw new Error('Concurrent finalize; a retry will reconcile', { cause: error });
      }
      // The invoice NUMBER is owned by a different order (an astronomically rare
      // collision). Fail fast instead of retrying the same deterministic number
      // forever.
      throw new PermanentFulfillmentError(
        `Invoice number collision for order ${orderId}; manual intervention required`,
      );
    }
    throw error;
  }

  log.info({ orderId }, 'Order fulfilled');
}

/**
 * Mark an order FAILED. Atomic and guarded: it only transitions FULFILLING ->
 * FAILED, and the order.failed event is written ONLY when that transition actually
 * happened. This makes it safe to call more than once (a second call is a no-op)
 * and stops it from recording a failure for an order that was never fulfilling.
 */
export async function markOrderFailed(
  orderId: string,
  correlationId: string,
  message: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.FULFILLING },
      data: { status: OrderStatus.FAILED },
    });
    if (updated.count === 0) return; // already failed/fulfilled, or never fulfilling

    await writeEvent(tx, {
      orderId,
      type: OrderEventType.ORDER_FAILED,
      correlationId,
      payload: { message },
    });
  });
}
