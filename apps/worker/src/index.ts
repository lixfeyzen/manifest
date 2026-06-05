import { UnrecoverableError, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@manifest/db';
import {
  FULFILLMENT_QUEUE_NAME,
  FulfillmentJobStatus,
  type FulfillmentJobData,
} from '@manifest/shared';
import { env } from './env.js';
import { logger } from './logger.js';
import {
  PermanentFulfillmentError,
  markOrderFailed,
  runFulfillment,
} from './fulfillment-processor.js';

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

/**
 * The fulfillment worker (queue consumer). It runs the domain fulfillment logic
 * and translates the outcome into BullMQ + FulfillmentJob bookkeeping:
 *  - permanent errors are wrapped in UnrecoverableError so BullMQ stops retrying
 *  - transient errors bubble up so BullMQ retries with exponential backoff
 */
const worker = new Worker<FulfillmentJobData>(
  FULFILLMENT_QUEUE_NAME,
  async (job) => {
    if (job.id) {
      await prisma.fulfillmentJob.updateMany({
        where: { bullJobId: job.id },
        data: { status: FulfillmentJobStatus.PROCESSING, attempts: job.attemptsMade + 1 },
      });
    }

    try {
      await runFulfillment(job.data);
    } catch (error) {
      if (error instanceof PermanentFulfillmentError) {
        // Tell BullMQ not to retry — this failure will never succeed.
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }

    if (job.id) {
      await prisma.fulfillmentJob.updateMany({
        where: { bullJobId: job.id },
        data: { status: FulfillmentJobStatus.COMPLETED },
      });
    }
  },
  { connection, concurrency: 5 },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, orderId: job.data.orderId }, 'Fulfillment job completed');
});

worker.on('failed', async (job, error) => {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? 1;
  const isFinal = error.name === 'UnrecoverableError' || job.attemptsMade >= maxAttempts;

  logger.warn(
    { jobId: job.id, orderId: job.data?.orderId, attempt: job.attemptsMade, isFinal, err: error.message },
    isFinal ? 'Fulfillment job failed permanently' : 'Fulfillment attempt failed; will retry',
  );

  if (job.id) {
    await prisma.fulfillmentJob.updateMany({
      where: { bullJobId: job.id },
      data: {
        status: isFinal ? FulfillmentJobStatus.FAILED : FulfillmentJobStatus.QUEUED,
        lastError: error.message,
        attempts: job.attemptsMade,
      },
    });
  }

  if (isFinal && job.data) {
    await markOrderFailed(job.data.orderId, job.data.correlationId, error.message);
  }
});

worker.on('ready', () => {
  logger.info(`Manifest worker ready — consuming "${FULFILLMENT_QUEUE_NAME}" queue`);
});

// Graceful shutdown so in-flight jobs finish and connections close cleanly.
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down worker');
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
