import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
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
    `TRUNCATE TABLE "Session","User","OrderEvent","InventoryReservation","Payment","Invoice","FulfillmentJob","OrderItem","ProcessedEvent","Order","InventoryItem" RESTART IDENTITY CASCADE`,
  );
}

/**
 * Register a fresh user via the real /auth/register route and return the signed
 * `sid` cookie string for use in subsequent authenticated `app.inject` calls.
 * Driving the real route guarantees the cookie's signature matches the server's.
 */
export async function authCookie(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: `user-${randomUUID()}@example.com`, password: 'password123' }),
  });
  const setCookie = res.headers['set-cookie'];
  const raw = Array.isArray(setCookie) ? setCookie[0]! : (setCookie as string);
  return raw.split(';')[0]!; // "sid=<signed-value>"
}

export async function seedInventory(): Promise<void> {
  for (const item of INVENTORY) {
    await prisma.inventoryItem.create({ data: item });
  }
}

/** Reset + reseed inventory: the standard per-test starting point. */
export async function resetAndSeed(): Promise<void> {
  await resetDb();
  await seedInventory();
}
