import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { FULFILLMENT_QUEUE_NAME, type FulfillmentJobData } from '@manifest/shared';
import { env } from './env.js';

/**
 * Redis connection shared by the BullMQ producer. `maxRetriesPerRequest: null`
 * is required by BullMQ so commands are not dropped while Redis reconnects.
 */
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

/**
 * The fulfillment queue. The API is only a *producer* here — it enqueues jobs.
 * The actual processing happens in apps/worker (the consumer). Splitting produce
 * from consume is what makes this event-driven: the webhook returns instantly and
 * the slow fulfillment work happens asynchronously.
 */
export const fulfillmentQueue = new Queue<FulfillmentJobData>(FULFILLMENT_QUEUE_NAME, {
  connection: redisConnection,
});
