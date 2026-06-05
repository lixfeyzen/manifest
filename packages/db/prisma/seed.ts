import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  FulfillmentJobStatus,
  InvoiceStatus,
  OrderEventType,
  OrderStatus,
  PaymentStatus,
} from '@manifest/shared';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INVENTORY = [
  { sku: 'SKU-COFFEE', name: 'Premium Coffee Beans', stock: 20, unitPrice: 120000 },
  { sku: 'SKU-HOODIE', name: 'Manifest Hoodie', stock: 5, unitPrice: 350000 },
  { sku: 'SKU-STICKER', name: 'Sticker Pack', stock: 100, unitPrice: 25000 },
];

// Realistic-looking customers so the orders table doesn't read like a test fixture.
const CUSTOMERS = [
  'olivia.martin@gmail.com',
  'liam.nguyen@outlook.com',
  'sophia.rossi@gmail.com',
  'noah.kim@proton.me',
  'emma.dubois@gmail.com',
  'lucas.silva@hotmail.com',
  'mia.tanaka@gmail.com',
  'ethan.brown@gmail.com',
  'ava.johnson@gmail.com',
  'arjun.patel@gmail.com',
  'chloe.weber@gmail.com',
  'daniel.aoki@outlook.com',
];

// A believable status mix spread across the last two weeks.
const PLAN: Array<{ daysAgo: number; status: OrderStatus }> = [
  { daysAgo: 13, status: OrderStatus.FULFILLED },
  { daysAgo: 12, status: OrderStatus.FULFILLED },
  { daysAgo: 11, status: OrderStatus.FAILED },
  { daysAgo: 10, status: OrderStatus.FULFILLED },
  { daysAgo: 9, status: OrderStatus.PAID },
  { daysAgo: 8, status: OrderStatus.FULFILLED },
  { daysAgo: 7, status: OrderStatus.FULFILLED },
  { daysAgo: 6, status: OrderStatus.FULFILLED },
  { daysAgo: 5, status: OrderStatus.FULFILLING },
  { daysAgo: 4, status: OrderStatus.FULFILLED },
  { daysAgo: 3, status: OrderStatus.FULFILLED },
  { daysAgo: 3, status: OrderStatus.PENDING },
  { daysAgo: 2, status: OrderStatus.FULFILLED },
  { daysAgo: 1, status: OrderStatus.PAID },
  { daysAgo: 1, status: OrderStatus.FAILED },
  { daysAgo: 0, status: OrderStatus.FULFILLED },
  { daysAgo: 0, status: OrderStatus.PENDING },
];

const shortId = (id: string) => id.replace(/-/g, '').slice(-8).toUpperCase();

/** Which lifecycle events an order has reached, in order, for a given status. */
function eventsFor(status: OrderStatus): string[] {
  const base = [OrderEventType.ORDER_CREATED];
  if (status === OrderStatus.PENDING) return base;
  const paid = [
    ...base,
    OrderEventType.PAYMENT_WEBHOOK_RECEIVED,
    OrderEventType.PAYMENT_SUCCEEDED,
    OrderEventType.FULFILLMENT_QUEUED,
  ];
  if (status === OrderStatus.PAID) return paid;
  if (status === OrderStatus.FAILED)
    return [...paid, OrderEventType.FULFILLMENT_STARTED, OrderEventType.ORDER_FAILED];
  if (status === OrderStatus.FULFILLING) return [...paid, OrderEventType.FULFILLMENT_STARTED];
  return [
    ...paid,
    OrderEventType.FULFILLMENT_STARTED,
    OrderEventType.INVENTORY_RESERVED,
    OrderEventType.INVOICE_GENERATED,
    OrderEventType.ORDER_FULFILLED,
  ];
}

async function seedOrders(): Promise<void> {
  // Only seed when empty so we never clobber orders created by hand.
  if ((await prisma.order.count()) > 0) {
    console.log('Orders already present — skipping demo-order seed.');
    return;
  }

  const priceOf = new Map(INVENTORY.map((i) => [i.sku, i]));

  for (let i = 0; i < PLAN.length; i++) {
    const spec = PLAN[i]!;
    const product = INVENTORY[i % INVENTORY.length]!;
    const quantity = (i % 3) + 1;
    const unitPrice = priceOf.get(product.sku)!.unitPrice;
    const totalAmount = unitPrice * quantity;
    const customerEmail = CUSTOMERS[i % CUSTOMERS.length]!;
    const created = new Date(Date.now() - spec.daysAgo * 86_400_000 - (i % 9) * 3_600_000);
    const correlationId = `seed_${randomUUID()}`;
    const events = eventsFor(spec.status);
    const paid = spec.status !== OrderStatus.PENDING;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerEmail,
          totalAmount,
          status: spec.status,
          createdAt: created,
          items: {
            create: [{ sku: product.sku, name: product.name, quantity, unitPrice }],
          },
          events: {
            create: events.map((type, e) => ({
              type,
              correlationId,
              payload: {},
              createdAt: new Date(created.getTime() + e * 60_000),
            })),
          },
        },
      });

      if (paid) {
        await tx.payment.create({
          data: {
            orderId: order.id,
            providerEventId: `evt_seed_${i}`,
            idempotencyKey: `payment_seed_${i}`,
            amount: totalAmount,
            status: PaymentStatus.SUCCEEDED,
            rawPayload: {},
            createdAt: new Date(created.getTime() + 2 * 60_000),
          },
        });

        const jobStatus =
          spec.status === OrderStatus.FULFILLED
            ? FulfillmentJobStatus.COMPLETED
            : spec.status === OrderStatus.FAILED
              ? FulfillmentJobStatus.FAILED
              : spec.status === OrderStatus.FULFILLING
                ? FulfillmentJobStatus.PROCESSING
                : FulfillmentJobStatus.QUEUED;
        await tx.fulfillmentJob.create({
          data: {
            orderId: order.id,
            bullJobId: `fulfillment-${order.id}`,
            status: jobStatus,
            attempts: spec.status === OrderStatus.FAILED ? 3 : 1,
            lastError:
              spec.status === OrderStatus.FAILED
                ? 'Insufficient stock for ' + product.sku
                : null,
          },
        });
      }

      if (spec.status === OrderStatus.FULFILLED) {
        const d = created;
        const invoiceNumber = `INV-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}-${shortId(order.id)}`;
        await tx.invoice.create({
          data: {
            orderId: order.id,
            invoiceNumber,
            amount: totalAmount,
            status: InvoiceStatus.ISSUED,
            createdAt: new Date(created.getTime() + 4 * 60_000),
          },
        });
      }
    });
  }

  console.log(`Seeded ${PLAN.length} demo orders.`);
}

async function main(): Promise<void> {
  for (const item of INVENTORY) {
    await prisma.inventoryItem.upsert({
      where: { sku: item.sku },
      update: { name: item.name, stock: item.stock, unitPrice: item.unitPrice },
      create: item,
    });
  }
  console.log(`Seeded ${INVENTORY.length} inventory items.`);

  // Demo data — local/dev only, never in production.
  if (process.env.NODE_ENV !== 'production') {
    const email = 'demo@manifest.dev';
    const passwordHash = await bcrypt.hash('demo12345', 12);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, passwordHash },
    });
    console.log(`Seeded demo user: ${email} / demo12345`);

    await seedOrders();
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
