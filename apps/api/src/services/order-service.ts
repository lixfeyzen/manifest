import { prisma, type Order, type Prisma } from '@manifest/db';
import { UnknownSkuError } from '@manifest/domain';
import {
  OrderEventType,
  OrderStatus,
  createOrderSchema,
  type CreateOrderInput,
} from '@manifest/shared';
import { randomUUID } from 'node:crypto';
import { writeEvent } from './event-service.js';

/**
 * Create a new order from validated input.
 *
 * Pricing is taken from the seeded InventoryItem table, never trusted from the
 * client, so the total can't be tampered with. Stock is NOT decremented here;
 * reservation happens later during fulfillment (after payment), which is what
 * keeps unpaid orders from holding inventory.
 */
export async function createOrder(rawInput: CreateOrderInput): Promise<Order> {
  // Validate again at the service boundary so this function is safe to call from
  // anywhere (GraphQL resolver, a test, a future CLI), not just the HTTP layer.
  const input = createOrderSchema.parse(rawInput);
  const correlationId = `order_${randomUUID()}`;

  // Look up every SKU up front; fail clearly if any is unknown.
  const skus = input.items.map((i) => i.sku);
  const inventory = await prisma.inventoryItem.findMany({ where: { sku: { in: skus } } });
  const bySku = new Map(inventory.map((item) => [item.sku, item]));

  // Merge duplicate SKUs into one line each (summed quantity) so the order respects
  // the OrderItem (orderId, sku) unique constraint and one-reservation-per-sku.
  const quantityBySku = new Map<string, number>();
  for (const item of input.items) {
    quantityBySku.set(item.sku, (quantityBySku.get(item.sku) ?? 0) + item.quantity);
  }

  const lineItems = [...quantityBySku.entries()].map(([sku, quantity]) => {
    const product = bySku.get(sku);
    if (!product) {
      throw new UnknownSkuError(sku);
    }
    return {
      sku: product.sku,
      name: product.name,
      quantity,
      unitPrice: product.unitPrice,
    };
  });

  const totalAmount = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // One transaction: the order, its items, and the "order.created" event either
  // all land together or not at all.
  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        customerEmail: input.customerEmail,
        totalAmount,
        status: OrderStatus.PENDING,
        items: { create: lineItems },
      },
    });

    await writeEvent(tx, {
      orderId: order.id,
      type: OrderEventType.ORDER_CREATED,
      correlationId,
      payload: { customerEmail: order.customerEmail, totalAmount, items: lineItems },
    });

    return order;
  });

  // Return the full order (with relations + the created event) so GraphQL can
  // resolve every requested field.
  const full = await getOrder(created.id);
  if (!full) {
    throw new Error(`Order ${created.id} vanished immediately after creation`);
  }
  return full;
}

/** Include shape used whenever we return a "full" order (the detail view). */
export const orderInclude = {
  items: true,
  payment: true,
  invoice: true,
  fulfillmentJobs: { orderBy: { createdAt: 'desc' } },
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

/**
 * Slim include for LIST views. The list only needs scalars plus the most recent
 * event ("last event"), so we pull just one event instead of every event, payment,
 * invoice and job for every row.
 */
export const orderListInclude = {
  events: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.OrderInclude;

const MAX_ORDERS_PAGE = 100;

/** Bounded, slim, time-ordered list of orders (newest first). */
export async function getOrders(status?: OrderStatus, limit = 50) {
  return prisma.order.findMany({
    where: status ? { status } : undefined,
    include: orderListInclude,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), MAX_ORDERS_PAGE),
  });
}

export async function getOrder(id: string) {
  return prisma.order.findUnique({ where: { id }, include: orderInclude });
}

export async function getInventoryItems() {
  return prisma.inventoryItem.findMany({ orderBy: { sku: 'asc' } });
}
