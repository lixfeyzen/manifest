import { PrismaClient } from '@prisma/client';

/**
 * A single shared PrismaClient instance. In dev we cache it on globalThis so that
 * hot-reloading (tsx watch / Next.js) does not exhaust the connection pool by
 * creating a new client on every reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export Prisma's generated types and enums so other packages import them from
// a single place (@manifest/db) instead of reaching into @prisma/client directly.
export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';
