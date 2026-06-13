import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@manifest/db';
import { buildServer } from '../src/server.js';
import { fulfillmentQueue, redisConnection } from '../src/queue.js';
import { createOrder } from '../src/services/order-service.js';
import { authCookie, resetAndSeed } from './helpers.js';

const RETRY_MUTATION = `mutation Retry($orderId: ID!) {
  retryFulfillment(orderId: $orderId) { ok message status }
}`;

describe('retryFulfillment (GraphQL integration)', () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    app = await buildServer({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await fulfillmentQueue.close();
    await redisConnection.quit();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetAndSeed();
    // GraphQL requires a session; register a fresh user and reuse its cookie.
    cookie = await authCookie(app);
    // retryFulfillment enqueues a fulfillment job, clear any leftovers first.
    await fulfillmentQueue.obliterate({ force: true });
  });

  async function graphql(query: string, variables?: Record<string, unknown>) {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json', cookie },
      payload: JSON.stringify({ query, variables }),
    });
    return res.json();
  }

  async function newOrder() {
    return createOrder({
      customerEmail: 'buyer@example.com',
      items: [{ sku: 'SKU-COFFEE', quantity: 1 }],
    });
  }

  it('is a safe no-op on an already-fulfilled order (no new job)', async () => {
    const order = await newOrder();
    await prisma.order.update({ where: { id: order.id }, data: { status: 'FULFILLED' } });

    const before = await prisma.fulfillmentJob.count({ where: { orderId: order.id } });

    const body = await graphql(RETRY_MUTATION, { orderId: order.id });

    expect(body.errors).toBeUndefined();
    const result = body.data.retryFulfillment;
    expect(result.ok).toBe(true);
    expect(result.message.toLowerCase()).toContain('already fulfilled');
    expect(result.status).toBe('FULFILLED');

    // No FulfillmentJob row was created by the no-op.
    const after = await prisma.fulfillmentJob.count({ where: { orderId: order.id } });
    expect(after).toBe(before);
  });

  it('re-queues a FAILED order: new job + retry event', async () => {
    const order = await newOrder();
    await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });

    const before = await prisma.fulfillmentJob.count({ where: { orderId: order.id } });

    const body = await graphql(RETRY_MUTATION, { orderId: order.id });

    expect(body.errors).toBeUndefined();
    const result = body.data.retryFulfillment;
    expect(result.ok).toBe(true);

    // A NEW FulfillmentJob row exists with a retry bullJobId.
    const jobs = await prisma.fulfillmentJob.findMany({ where: { orderId: order.id } });
    expect(jobs).toHaveLength(before + 1);
    const retryJob = jobs.find((j) => j.bullJobId?.includes('-retry-'));
    expect(retryJob).toBeDefined();

    // A fulfillment.retry_requested event was written.
    const events = await prisma.orderEvent.findMany({
      where: { orderId: order.id, type: 'fulfillment.retry_requested' },
    });
    expect(events).toHaveLength(1);
  });

  it('maps an unknown order to an ORDER_NOT_FOUND GraphQL error', async () => {
    const body = await graphql(RETRY_MUTATION, { orderId: randomUUID() });

    expect(body.errors).toBeDefined();
    expect(body.errors[0].extensions.code).toBe('ORDER_NOT_FOUND');
  });
});
