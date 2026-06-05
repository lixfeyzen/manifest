import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@manifest/db';
import { buildServer } from '../src/server.js';
import { fulfillmentQueue, redisConnection } from '../src/queue.js';
import { authCookie, resetAndSeed } from './helpers.js';

describe('createOrder (GraphQL integration)', () => {
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
    // GraphQL now requires a session; register a fresh user and reuse its cookie.
    cookie = await authCookie(app);
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

  it('creates a PENDING order with correct total priced from inventory', async () => {
    const body = await graphql(
      `mutation($input: CreateOrderInput!) {
        createOrder(input: $input) { id status totalAmount items { sku quantity unitPrice } }
      }`,
      { input: { customerEmail: 'buyer@example.com', items: [{ sku: 'SKU-COFFEE', quantity: 2 }] } },
    );

    const order = body.data.createOrder;
    expect(order.status).toBe('PENDING');
    // 2 x 120000 (from inventory, not from the client)
    expect(order.totalAmount).toBe(240000);
    expect(order.items).toHaveLength(1);

    // An order.created event is recorded with a correlationId.
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('order.created');
    expect(events[0]!.correlationId).toBeTruthy();
  });

  it('rejects an unknown SKU', async () => {
    const body = await graphql(
      `mutation($input: CreateOrderInput!) { createOrder(input: $input) { id } }`,
      { input: { customerEmail: 'buyer@example.com', items: [{ sku: 'SKU-NOPE', quantity: 1 }] } },
    );
    expect(body.errors?.[0]?.message).toContain('Unknown SKU');
  });
});
