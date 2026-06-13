import { Prisma, prisma } from '@manifest/db';
import {
  InsufficientStockError,
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
      // Guarded transition: the WHERE clause makes the live DB row the precondition
      // (not the status we read earlier), so two concurrent jobs can't both apply it.
      // If another worker already advanced this order, count is 0 — skip the event and
      // resume in Phase 2/3 rather than re-writing a started event or demoting a
      // terminal status. This mirrors the guarded markOrderFailed below.
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: { in: [OrderStatus.PAID, OrderStatus.FAILED] } },
        data: { status: OrderStatus.FULFILLING },
      });
      if (moved.count === 0) return;
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
    // A concurrent attempt may have created the reservation first (P2002): the
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

      // Guarded finalize: only FULFILLING -> FULFILLED, enforced by the WHERE clause so
      // a concurrent job (e.g. a parallel reconcile/retry) can never resurrect an order
      // that was meanwhile FAILED into FULFILLED. count 0 => the status changed under us;
      // roll back (dropping any invoice written above) and let a retry re-derive it.
      const finalized = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.FULFILLING },
        data: { status: OrderStatus.FULFILLED },
      });
      if (finalized.count === 0) {
        throw new Error('Order is no longer FULFILLING; concurrent transition, will retry');
      }
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
      // The invoice NUMBER is owned by a different order. Invoice numbers are derived
      // from the FULL order UUID (see buildInvoiceNumber), so distinct orders cannot
      // produce the same number — this branch is effectively unreachable and exists
      // only as a fail-fast guard rather than retrying a deterministic number forever.
      throw new PermanentFulfillmentError(
        `Invoice number collision for order ${orderId}; manual intervention required`,
      );
    }
    throw error;
  }

  log.info({ orderId }, 'Order fulfilled');
}

/**
 * Mark an order FAILED. Atomic and guarded: it transitions PAID or FULFILLING ->
 * FAILED, and the order.failed event is written ONLY when that transition actually
 * happened. Covering PAID matters because a job can exhaust its retries before
 * Phase 1 ever moves the order to FULFILLING; without it such an order would be
 * stuck PAID. Safe to call more than once (a second call is a no-op) and it never
 * touches a PENDING or already-terminal order.
 */
export async function markOrderFailed(
  orderId: string,
  correlationId: string,
  message: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: { in: [OrderStatus.PAID, OrderStatus.FULFILLING] } },
      data: { status: OrderStatus.FAILED },
    });
    if (updated.count === 0) return; // already failed/fulfilled, or still pending

    await writeEvent(tx, {
      orderId,
      type: OrderEventType.ORDER_FAILED,
      correlationId,
      payload: { message },
    });
  });
}
