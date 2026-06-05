import { prisma } from '@manifest/db';
import {
  InsufficientStockError,
  assertTransition,
  buildInvoiceNumber,
  decideFulfillment,
  reserveStock,
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
 * same order — every side effect checks whether it has already happened:
 *
 *   - status transitions go through the domain state machine
 *   - inventory is only reserved for an (order, sku) pair that has no reservation
 *   - an invoice is only created if the order has none
 *
 * This is what makes BullMQ retries (and the manual "Retry" button) safe: a second
 * run cannot double-deduct stock or issue a second invoice.
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
    log.info({ orderId }, 'Order already fulfilled — no-op');
    return;
  }

  // PAID/FAILED -> FULFILLING (a 'continue' action means it is already FULFILLING).
  if (action.kind === 'start') {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: assertTransition(order.status as OrderStatus, OrderStatus.FULFILLING) },
    });
  }

  await writeEvent(prisma, {
    orderId,
    type: OrderEventType.FULFILLMENT_STARTED,
    correlationId,
    payload: { attemptFrom: order.status },
  });

  // ---- Reserve inventory (retry-safe, atomic) -------------------------------
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryReservation.findMany({
        where: { orderId },
        select: { sku: true },
      });
      const reservedSkus = new Set(existing.map((r) => r.sku));

      for (const item of order.items) {
        // Already reserved on a previous attempt → skip (no double deduction).
        if (reservedSkus.has(item.sku)) continue;

        const inv = await tx.inventoryItem.findUnique({ where: { sku: item.sku } });
        if (!inv) {
          throw new InsufficientStockError(item.sku, item.quantity, 0);
        }

        // Domain rule: never lets stock drop below zero.
        const newStock = reserveStock(item.sku, inv.stock, item.quantity);
        await tx.inventoryItem.update({ where: { sku: item.sku }, data: { stock: newStock } });
        await tx.inventoryReservation.create({
          data: { orderId, sku: item.sku, quantity: item.quantity },
        });
      }
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      // Permanent: mark the order failed and stop retrying.
      await markOrderFailed(orderId, correlationId, error.message);
      throw new PermanentFulfillmentError(error.message);
    }
    throw error; // transient (e.g. DB blip) → let BullMQ retry
  }

  await writeEvent(prisma, {
    orderId,
    type: OrderEventType.INVENTORY_RESERVED,
    correlationId,
    payload: { items: order.items.map((i) => ({ sku: i.sku, quantity: i.quantity })) },
  });

  // ---- Generate invoice (only once per order) -------------------------------
  const existingInvoice = await prisma.invoice.findUnique({ where: { orderId } });
  if (shouldCreateInvoice(existingInvoice?.id)) {
    const invoiceNumber = buildInvoiceNumber(orderId, new Date());
    await prisma.invoice.create({
      data: {
        orderId,
        invoiceNumber,
        amount: order.totalAmount,
        status: InvoiceStatus.ISSUED,
      },
    });
    await writeEvent(prisma, {
      orderId,
      type: OrderEventType.INVOICE_GENERATED,
      correlationId,
      payload: { invoiceNumber, amount: order.totalAmount },
    });
  }

  // ---- Finalize -------------------------------------------------------------
  await prisma.order.update({
    where: { id: orderId },
    data: { status: assertTransition(OrderStatus.FULFILLING, OrderStatus.FULFILLED) },
  });
  await writeEvent(prisma, {
    orderId,
    type: OrderEventType.ORDER_FULFILLED,
    correlationId,
  });

  log.info({ orderId }, 'Order fulfilled');
}

/**
 * Mark an order FAILED (only valid from FULFILLING) and record an order.failed
 * event. Safe to call when the order is already FAILED — it just skips the
 * transition so we never write a duplicate failure event.
 */
export async function markOrderFailed(
  orderId: string,
  correlationId: string,
  message: string,
): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === OrderStatus.FAILED) return;

  if (order.status === OrderStatus.FULFILLING) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.FAILED },
    });
  }

  await writeEvent(prisma, {
    orderId,
    type: OrderEventType.ORDER_FAILED,
    correlationId,
    payload: { message },
  });
}
