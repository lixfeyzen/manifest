import { prisma, type Order } from '@manifest/db';

const INVENTORY = [
  { sku: 'SKU-COFFEE', name: 'Premium Coffee Beans', stock: 20, unitPrice: 120000 },
  { sku: 'SKU-HOODIE', name: 'Manifest Hoodie', stock: 5, unitPrice: 350000 },
  { sku: 'SKU-STICKER', name: 'Sticker Pack', stock: 100, unitPrice: 25000 },
];

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "OrderEvent","InventoryReservation","Payment","Invoice","FulfillmentJob","OrderItem","ProcessedEvent","Order","InventoryItem" RESTART IDENTITY CASCADE`,
  );
}

export async function seedInventory(): Promise<void> {
  for (const item of INVENTORY) {
    await prisma.inventoryItem.create({ data: item });
  }
}

export async function resetAndSeed(): Promise<void> {
  await resetDb();
  await seedInventory();
}

/**
 * Create an order already in PAID status (as it would be after a payment
 * webhook), ready for the worker to fulfill. Returns the created order.
 */
export async function createPaidOrder(sku: string, quantity: number): Promise<Order> {
  const inv = await prisma.inventoryItem.findUniqueOrThrow({ where: { sku } });
  return prisma.order.create({
    data: {
      customerEmail: 'buyer@example.com',
      totalAmount: inv.unitPrice * quantity,
      status: 'PAID',
      items: { create: [{ sku, name: inv.name, quantity, unitPrice: inv.unitPrice }] },
    },
  });
}
