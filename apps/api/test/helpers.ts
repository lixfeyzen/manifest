import { prisma } from '@manifest/db';

/** Inventory matching the seed, recreated fresh for each test. */
const INVENTORY = [
  { sku: 'SKU-COFFEE', name: 'Premium Coffee Beans', stock: 20, unitPrice: 120000 },
  { sku: 'SKU-HOODIE', name: 'Manifest Hoodie', stock: 5, unitPrice: 350000 },
  { sku: 'SKU-STICKER', name: 'Sticker Pack', stock: 100, unitPrice: 25000 },
];

/** Wipe every table so each test starts from a clean, deterministic state. */
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

/** Reset + reseed inventory — the standard per-test starting point. */
export async function resetAndSeed(): Promise<void> {
  await resetDb();
  await seedInventory();
}
