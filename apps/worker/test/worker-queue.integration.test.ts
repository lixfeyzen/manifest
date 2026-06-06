import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Queue, UnrecoverableError, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@manifest/db';
import { FULFILLMENT_JOB_OPTIONS, type FulfillmentJobData } from '@manifest/shared';
import { env } from '../src/env.js';
import {
  PermanentFulfillmentError,
  markOrderFailed,
  runFulfillment,
} from '../src/fulfillment-processor.js';
import { createPaidOrder, resetAndSeed } from './helpers.js';

// Exercises the real BullMQ worker layer (retry/permanent semantics), which the
// direct-call fulfillment tests do not cover. We stand up our OWN isolated queue +
// worker on a UNIQUE queue name so we never collide with a dev worker that may be
// consuming the real "fulfillment" queue on the same Redis.
const QUEUE_NAME = `fulfillment-test-${process.pid}`;

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue<FulfillmentJobData>(QUEUE_NAME, { connection });

// The processor mirrors apps/worker/src/index.ts: run the domain logic, and turn a
// permanent failure into an UnrecoverableError so BullMQ stops retrying.
const worker = new Worker<FulfillmentJobData>(
  QUEUE_NAME,
  async (job) => {
    try {
      await runFulfillment(job.data);
    } catch (error) {
      if (error instanceof PermanentFulfillmentError) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  },
  { connection, concurrency: 1 },
);

// Mirror index.ts's 'failed' handler: when the failure is final, mark the order FAILED.
worker.on('failed', async (job, error) => {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? 1;
  const isFinal = error.name === 'UnrecoverableError' || job.attemptsMade >= maxAttempts;
  if (isFinal && job.data) {
    await markOrderFailed(job.data.orderId, job.data.correlationId, error.message);
  }
});

/** Resolve once the worker emits `event` for the given job id. */
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

describe('worker queue layer (BullMQ retry/permanent semantics)', () => {
  beforeEach(async () => {
    await resetAndSeed();
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await worker.close();
    await queue.obliterate({ force: true });
    await connection.quit();
    await prisma.$disconnect();
  });

  it('happy path: a queued job fulfills the order and decrements stock once', async () => {
    const order = await createPaidOrder('SKU-STICKER', 2);

    const job = await queue.add(
      'fulfill',
      { orderId: order.id, correlationId: 'corr_queue_ok' },
      FULFILLMENT_JOB_OPTIONS,
    );

    const completed = await waitForJob('completed', job.id!);

    expect(completed.attemptsMade).toBe(1);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe('FULFILLED');

    const stock = await prisma.inventoryItem.findUnique({ where: { sku: 'SKU-STICKER' } });
    expect(stock!.stock).toBe(98); // 100 - 2, decremented exactly once

    expect(await prisma.invoice.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.inventoryReservation.count({ where: { orderId: order.id } })).toBe(1);
  }, 20000);

  it('permanent failure: insufficient stock fails the job without retrying', async () => {
    const order = await createPaidOrder('SKU-HOODIE', 6); // only 5 in stock

    const job = await queue.add(
      'fulfill',
      { orderId: order.id, correlationId: 'corr_queue_fail' },
      FULFILLMENT_JOB_OPTIONS,
    );

    const failed = await waitForJob('failed', job.id!);

    // UnrecoverableError stops BullMQ from retrying: it failed on the first attempt
    // and never re-ran, even though FULFILLMENT_JOB_OPTIONS allows 3 attempts.
    expect(failed.attemptsMade).toBe(1);
    expect(FULFILLMENT_JOB_OPTIONS.attempts).toBeGreaterThan(1);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe('FAILED');

    const stock = await prisma.inventoryItem.findUnique({ where: { sku: 'SKU-HOODIE' } });
    expect(stock!.stock).toBe(5); // unchanged — the reserve transaction rolled back

    expect(await prisma.inventoryReservation.count({ where: { orderId: order.id } })).toBe(0);
  }, 20000);
});
