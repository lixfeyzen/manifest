import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@manifest/db';
import { buildServer } from '../src/server.js';
import { fulfillmentQueue, redisConnection } from '../src/queue.js';
import { createOrder } from '../src/services/order-service.js';
import { resetAndSeed } from './helpers.js';

describe('payment webhook (REST integration)', () => {
  let app: FastifyInstance;

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
    // Clear any jobs enqueued by a previous test.
    await fulfillmentQueue.obliterate({ force: true });
  });

  async function postWebhook(orderId: string, correlationId: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/payment',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        eventId: `evt_${orderId}`,
        orderId,
        type: 'payment.succeeded',
        amount: 120000,
        idempotencyKey: `payment_${orderId}_demo`,
        correlationId,
      }),
    });
    return { status: res.statusCode, body: res.json() };
  }

  async function newOrder() {
    return createOrder({ customerEmail: 'buyer@example.com', items: [{ sku: 'SKU-COFFEE', quantity: 1 }] });
  }

  it('processes the first webhook: order PAID, payment + job created', async () => {
    const order = await newOrder();
    const { status, body } = await postWebhook(order.id, 'corr_first');

    expect(status).toBe(200);
    expect(body.status).toBe('processed');

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe('PAID');
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.fulfillmentJob.count({ where: { orderId: order.id } })).toBe(1);

    const processed = await prisma.processedEvent.findUnique({
      where: { idempotencyKey: `payment_${order.id}_demo` },
    });
    expect(processed!.status).toBe('PROCESSED');
  });

  it('ignores a duplicate webhook (same idempotencyKey)', async () => {
    const order = await newOrder();
    await postWebhook(order.id, 'corr_first');
    const second = await postWebhook(order.id, 'corr_second');

    expect(second.status).toBe(200);
    expect(second.body.status).toBe('ignored');
  });

  it('does not create a duplicate payment on a duplicate webhook', async () => {
    const order = await newOrder();
    await postWebhook(order.id, 'corr_first');
    await postWebhook(order.id, 'corr_second');

    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('does not create a duplicate fulfillment job on a duplicate webhook', async () => {
    const order = await newOrder();
    await postWebhook(order.id, 'corr_first');
    await postWebhook(order.id, 'corr_second');

    expect(await prisma.fulfillmentJob.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('records a duplicate_event.ignored event for the duplicate', async () => {
    const order = await newOrder();
    await postWebhook(order.id, 'corr_first');
    await postWebhook(order.id, 'corr_second');

    const ignored = await prisma.orderEvent.count({
      where: { orderId: order.id, type: 'duplicate_event.ignored' },
    });
    expect(ignored).toBe(1);
  });

  it('returns 404 for a webhook referencing a missing order', async () => {
    const { status } = await postWebhook('00000000-0000-0000-0000-000000000000', 'corr_missing');
    expect(status).toBe(404);
  });
});
