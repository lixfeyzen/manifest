import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@manifest/db';
import { type FulfillmentJobData } from '@manifest/shared';
import { env } from '../src/env.js';
import { STUCK_AFTER_MS, reconcileStuckOrders } from '../src/reconcile.js';
import { createPaidOrder, resetAndSeed } from './helpers.js';

// The crash-gap sweeper (self-healing) must re-enqueue an order left PAID past the
// cutoff, and leave a freshly-paid order alone. Own isolated queue with NO worker
// consuming it, so we can inspect exactly what was enqueued.
const QUEUE_NAME = `fulfillment-reconcile-test-${process.pid}`;
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue<FulfillmentJobData>(QUEUE_NAME, { connection });

/** Force an order's updatedAt back in time. updatedAt is @updatedAt, so use raw SQL. */
async function ageOrder(orderId: string, ms: number): Promise<void> {
  const old = new Date(Date.now() - ms);
  await prisma.$executeRaw`UPDATE "Order" SET "updatedAt" = ${old} WHERE id = ${orderId}`;
}

describe('reconcileStuckOrders (crash-gap recovery)', () => {
  beforeEach(async () => {
    await resetAndSeed();
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await connection.quit();
    await prisma.$disconnect();
  });

  it('re-enqueues an order stuck in PAID past the cutoff and records a job row', async () => {
    const order = await createPaidOrder('SKU-STICKER', 1);
    await ageOrder(order.id, STUCK_AFTER_MS + 60_000); // comfortably past the cutoff

    await reconcileStuckOrders(queue);

    // Exactly one BullMQ job was enqueued, with a reconcile job id.
    const jobs = await queue.getJobs(['waiting', 'delayed', 'active']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.id).toContain('-reconcile-');

    // And a matching FulfillmentJob bookkeeping row exists so the worker can advance it.
    const jobRow = await prisma.fulfillmentJob.findFirst({
      where: { orderId: order.id, bullJobId: { contains: '-reconcile-' } },
    });
    expect(jobRow).not.toBeNull();
  }, 20000);

  it('leaves a freshly-paid order (within the cutoff) untouched', async () => {
    await createPaidOrder('SKU-STICKER', 1); // updatedAt = now, well within the cutoff

    await reconcileStuckOrders(queue);

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active']);
    expect(jobs).toHaveLength(0);
    expect(await prisma.fulfillmentJob.count()).toBe(0);
  }, 20000);
});
