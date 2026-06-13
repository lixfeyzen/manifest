import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@manifest/db';
import { FULFILLMENT_JOB_OPTIONS, type FulfillmentJobData } from '@manifest/shared';
import { env } from '../src/env.js';
import { runFulfillment } from '../src/fulfillment-processor.js';
import { createPaidOrder, resetAndSeed } from './helpers.js';

// Proves the transient-retry guarantee the README advertises: a plain Error (NOT a
// PermanentFulfillmentError) makes BullMQ retry with backoff, and the retry runs the
// real fulfillment to completion, exactly once. Own isolated queue + worker on a
// unique name so it never collides with a dev worker on the same Redis.
const QUEUE_NAME = `fulfillment-retry-test-${process.pid}`;

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue<FulfillmentJobData>(QUEUE_NAME, { connection });

// A module-level counter (reset per test) drives the fail-once behavior. This is more
// robust than reading job.attemptsMade, whose exact value across versions is fiddly.
let processorRuns = 0;

const worker = new Worker<FulfillmentJobData>(
  QUEUE_NAME,
  async (job) => {
    processorRuns += 1;
    // First attempt: simulate a transient infrastructure blip (e.g. a DB hiccup).
    if (processorRuns === 1) {
      throw new Error('transient blip (DB hiccup)');
    }
    // Retry: run the real, idempotent fulfillment.
    await runFulfillment(job.data);
  },
  { connection, concurrency: 1 },
);

function waitForJob(
  event: 'completed' | 'failed',
  jobId: string,
): Promise<Job<FulfillmentJobData>> {
  return new Promise((resolve, reject) => {
    const onDone = (job: Job<FulfillmentJobData> | undefined) => {
      if (job?.id !== jobId) return;
      cleanup();
      resolve(job);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      worker.off(event, onDone);
      worker.off('error', onError);
    };
    worker.on(event, onDone);
    worker.on('error', onError);
  });
}

describe('worker transient-retry semantics', () => {
  beforeEach(async () => {
    processorRuns = 0;
    await resetAndSeed();
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await worker.close();
    await queue.obliterate({ force: true });
    await connection.quit();
    await prisma.$disconnect();
  });

  it('a transient (plain) Error retries and then succeeds, fulfilling exactly once', async () => {
    const order = await createPaidOrder('SKU-STICKER', 1);

    const job = await queue.add(
      'fulfill',
      { orderId: order.id, correlationId: 'corr_transient_retry' },
      // Fast fixed backoff so the retry lands quickly in CI.
      { ...FULFILLMENT_JOB_OPTIONS, backoff: { type: 'fixed', delay: 50 } },
    );

    const completed = await waitForJob('completed', job.id!);

    // The processor ran twice: it failed once transiently, then the retry completed.
    expect(processorRuns).toBe(2);
    expect(completed.attemptsMade).toBeGreaterThanOrEqual(2);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe('FULFILLED');

    // Fulfilled exactly once despite the retry: one invoice, one reservation, stock -1.
    expect(await prisma.invoice.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.inventoryReservation.count({ where: { orderId: order.id } })).toBe(1);
    const stock = await prisma.inventoryItem.findUnique({ where: { sku: 'SKU-STICKER' } });
    expect(stock!.stock).toBe(99);
  }, 20000);
});
