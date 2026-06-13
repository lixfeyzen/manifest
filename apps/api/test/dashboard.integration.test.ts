import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@manifest/db';
import { FulfillmentJobStatus, OrderEventType, OrderStatus } from '@manifest/shared';
import { buildServer } from '../src/server.js';
import { fulfillmentQueue, redisConnection } from '../src/queue.js';
import { authCookie, resetAndSeed } from './helpers.js';

/**
 * Dashboard aggregation + list-query-shape integration tests.
 *
 * Orders are seeded directly via prisma with explicit statuses and a createdAt of
 * `now` (so every one falls inside the throughput window). Each order gets one
 * OrderEvent so the slim list query's `lastEvent` resolves to a real value.
 */
describe('dashboard (GraphQL integration)', () => {
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

  /**
   * Seed a KNOWN, fixed set of orders: 2 PENDING, 1 PAID, 3 FULFILLED, 1 FAILED
   * (7 total), all created `now`. Each order gets exactly one OrderEvent so the slim
   * list query's `lastEvent` is populated. Returns the ids in creation order.
   */
  async function seedOrders(): Promise<string[]> {
    const plan: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.PENDING,
      OrderStatus.PAID,
      OrderStatus.FULFILLED,
      OrderStatus.FULFILLED,
      OrderStatus.FULFILLED,
      OrderStatus.FAILED,
    ];
    const ids: string[] = [];
    const now = new Date();
    for (const status of plan) {
      const order = await prisma.order.create({
        data: {
          customerEmail: 'buyer@example.com',
          totalAmount: 120000,
          status,
          createdAt: now,
          events: {
            create: {
              type: OrderEventType.ORDER_CREATED,
              payload: { seeded: true },
              correlationId: `corr_${ids.length}`,
            },
          },
        },
      });
      ids.push(order.id);
    }
    return ids;
  }

  it('dashboardMetrics returns the exact counts seeded', async () => {
    const ids = await seedOrders();

    // The failed-jobs metric counts FulfillmentJob rows with status FAILED, not
    // orders, seed exactly one against an existing order.
    await prisma.fulfillmentJob.create({
      data: { orderId: ids[ids.length - 1]!, status: FulfillmentJobStatus.FAILED },
    });

    const body = await graphql(`
      query {
        dashboardMetrics {
          totalOrders
          pendingOrders
          paidOrders
          fulfilledOrders
          failedJobs
        }
      }
    `);

    expect(body.errors).toBeFalsy();
    expect(body.data.dashboardMetrics).toEqual({
      totalOrders: 7,
      pendingOrders: 2,
      paidOrders: 1,
      fulfilledOrders: 3,
      failedJobs: 1,
    });
  });

  it('orderThroughput(days: 14) returns 14 buckets; last is today; totals sum to the orders in the window', async () => {
    await seedOrders();

    const body = await graphql(`
      query {
        orderThroughput(days: 14) {
          date
          today
          total
        }
      }
    `);

    expect(body.errors).toBeFalsy();
    const buckets = body.data.orderThroughput as Array<{
      date: string;
      today: boolean;
      total: number;
    }>;

    expect(buckets).toHaveLength(14);
    // The window is ordered oldest -> newest, so the last bucket is today.
    expect(buckets[buckets.length - 1]!.today).toBe(true);
    expect(buckets.filter((b) => b.today)).toHaveLength(1);

    // Independently determine how many orders fall inside the same window the
    // service uses (start-of-day 13 days ago through now) and assert the summed
    // bucket totals match.
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);
    const ordersInWindow = await prisma.order.count({ where: { createdAt: { gte: since } } });

    const summed = buckets.reduce((acc, b) => acc + b.total, 0);
    expect(summed).toBe(ordersInWindow);
    // All 7 seeded orders were created `now`, so they are all in the window.
    expect(summed).toBe(7);
  });

  it('orders(limit: 2) is bounded to 2 slim rows, each with lastEvent but no items', async () => {
    await seedOrders();

    const body = await graphql(`
      query {
        orders(limit: 2) {
          id
          status
          lastEvent {
            type
          }
        }
      }
    `);

    expect(body.errors).toBeFalsy();
    const rows = body.data.orders as Array<{
      id: string;
      status: string;
      lastEvent: { type: string } | null;
    }>;

    // Bounded to the requested limit.
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.id).toBeTruthy();
      expect(row.status).toBeTruthy();
      // The slim list selection pulls the most recent event, so lastEvent resolves.
      expect(row.lastEvent).not.toBeNull();
      expect(row.lastEvent!.type).toBe(OrderEventType.ORDER_CREATED);
    }
  });
});
