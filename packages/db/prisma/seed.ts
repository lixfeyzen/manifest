import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed inventory items. Idempotent: re-running upserts by SKU so `pnpm db:seed`
 * can be run repeatedly without creating duplicates.
 */
const INVENTORY = [
  { sku: 'SKU-COFFEE', name: 'Premium Coffee Beans', stock: 20, unitPrice: 120000 },
  { sku: 'SKU-HOODIE', name: 'Manifest Hoodie', stock: 5, unitPrice: 350000 },
  { sku: 'SKU-STICKER', name: 'Sticker Pack', stock: 100, unitPrice: 25000 },
];

async function main(): Promise<void> {
  for (const item of INVENTORY) {
    await prisma.inventoryItem.upsert({
      where: { sku: item.sku },
      // Reset stock/name/price to the canonical seed values on re-run.
      update: { name: item.name, stock: item.stock, unitPrice: item.unitPrice },
      create: item,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${INVENTORY.length} inventory items.`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
