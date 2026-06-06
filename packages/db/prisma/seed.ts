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
  'isabella.costa@gmail.com',
  'mateo.garcia@outlook.com',
  'hannah.lee@gmail.com',
];

interface OrderSpec {
  status: OrderStatus;
  customer: string;
  sku: string;
  quantity: number;
  createdAt: Date;
}

/** Small fixed-seed PRNG so `db:reset` always produces the same believable set. */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A believable status for an order, given how old it is. History is terminal
 * (orders from days ago are done or failed — never still "pending"); only the
 * last day or two carries in-flight states, and today shows a live pipeline.
 * Failures are rare. This is the kind of truthfulness a careful reader checks.
 */
function statusFor(daysAgo: number, r: number): OrderStatus {
  if (daysAgo >= 3) return r < 0.92 ? OrderStatus.FULFILLED : OrderStatus.FAILED;
  if (daysAgo >= 1) {
    if (r < 0.7) return OrderStatus.FULFILLED;
    if (r < 0.85) return OrderStatus.PAID;
    if (r < 0.93) return OrderStatus.FULFILLING;
    return OrderStatus.FAILED;
  }
  // Today: a live pipeline across every stage.
  if (r < 0.3) return OrderStatus.FULFILLED;
  if (r < 0.55) return OrderStatus.PENDING;
  if (r < 0.8) return OrderStatus.PAID;
  if (r < 0.95) return OrderStatus.FULFILLING;
  return OrderStatus.FAILED;
}

/** Generate ~50 orders spread densely across the last 14 days. */
function buildPlan(): OrderSpec[] {
  const rand = mulberry32(20260606);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const elapsedToday = Date.now() - startOfToday.getTime();

  const plan: OrderSpec[] = [];
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const count = 2 + Math.floor(rand() * 4); // 2–5 orders per day
    for (let k = 0; k < count; k++) {
      const status = statusFor(daysAgo, rand());
      // Failures land on the scarce item, so "insufficient stock" stays truthful.
      const sku = status === OrderStatus.FAILED ? 'SKU-HOODIE' : pick(INVENTORY).sku;

      let createdAt: Date;
      if (daysAgo === 0) {
        // Earlier today (never in the future).
        createdAt = new Date(
          startOfToday.getTime() + Math.floor(rand() * Math.max(elapsedToday, 1)),
        );
      } else {
        const dayStart = startOfToday.getTime() - daysAgo * 86_400_000;
        createdAt = new Date(dayStart + Math.floor(rand() * 86_400_000));
      }

      plan.push({
        status,
        customer: pick(CUSTOMERS),
        sku,
        quantity: 1 + Math.floor(rand() * 3),
        createdAt,
      });
    }
  }

  // Oldest first, so insertion order matches the timeline.
  return plan.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

const shortId = (id: string): string => id.replace(/-/g, '').slice(-8).toUpperCase();

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
  const plan = buildPlan();

  for (let i = 0; i < plan.length; i++) {
    const spec = plan[i]!;
    const product = priceOf.get(spec.sku)!;
    const quantity = spec.quantity;
    const totalAmount = product.unitPrice * quantity;
    const created = spec.createdAt;
    const correlationId = `seed_${randomUUID()}`;
    const events = eventsFor(spec.status);
    const paid = spec.status !== OrderStatus.PENDING;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerEmail: spec.customer,
          totalAmount,
          status: spec.status,
          createdAt: created,
          items: {
            create: [
              { sku: product.sku, name: product.name, quantity, unitPrice: product.unitPrice },
            ],
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
              spec.status === OrderStatus.FAILED ? `Insufficient stock for ${product.sku}` : null,
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

  console.log(`Seeded ${plan.length} demo orders across 14 days.`);
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
