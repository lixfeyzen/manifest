import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@manifest/db';
import { buildServer } from '../src/server.js';
import { env } from '../src/env.js';
import { fulfillmentQueue, redisConnection } from '../src/queue.js';
import { createOrder } from '../src/services/order-service.js';
import { resetAndSeed } from './helpers.js';

const sign = (body: string) => createHmac('sha256', env.WEBHOOK_SECRET).update(body).digest('hex');

describe('payment webhook validation + signature ordering (REST integration)', () => {
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

  async function newOrder() {
    return createOrder({
      customerEmail: 'buyer@example.com',
      items: [{ sku: 'SKU-COFFEE', quantity: 1 }],
    });
  }

  it('rejects a correctly-signed but schema-invalid body (400) and creates nothing', async () => {
    const order = await newOrder();

    // Real order so orderId exists: failure is purely a Zod validation failure.
    // Two defects: amount is a string (should be int) and idempotencyKey is missing.
    const body = JSON.stringify({
      eventId: `evt_${order.id}`,
      orderId: order.id,
      type: 'payment.succeeded',
      amount: '120000',
      correlationId: 'corr_invalid_schema',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/payment',
      // Sign the malformed body with the REAL HMAC so it passes the signature
      // gate and reaches (and fails) schema validation.
      headers: { 'content-type': 'application/json', 'x-manifest-signature': sign(body) },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid webhook payload');

    // Nothing was persisted: no payment for this order and no ProcessedEvent.
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.fulfillmentJob.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.processedEvent.count()).toBe(0);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).not.toBe('PAID');
  });

  it('checks the signature BEFORE schema validation: invalid body with no signature -> 401', async () => {
    const order = await newOrder();

    // Same schema-invalid body, but sent WITHOUT a signature. If validation ran
    // first this would be a 400; because the signature gate runs first it is 401.
    const body = JSON.stringify({
      eventId: `evt_${order.id}`,
      orderId: order.id,
      type: 'payment.succeeded',
      amount: '120000',
      correlationId: 'corr_unsigned_invalid',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/payment',
      headers: { 'content-type': 'application/json' },
      payload: body,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid or missing webhook signature');

    // And nothing was processed.
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.processedEvent.count()).toBe(0);
  });
});
