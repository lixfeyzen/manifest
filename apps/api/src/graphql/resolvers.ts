import type { FulfillmentJob, Invoice, OrderEvent, Payment, Prisma } from '@manifest/db';
import type { CreateOrderInput, OrderStatus } from '@manifest/shared';
import { getDashboardMetrics, getOrderThroughput } from '../services/dashboard-service.js';
import { retryFulfillment } from '../services/fulfillment-service.js';
import {
  createOrder,
  getInventoryItems,
  getOrder,
  getOrders,
  orderInclude,
} from '../services/order-service.js';

/** Order shape returned by the order service (with its relations included). */
type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const iso = (date: Date): string => date.toISOString();

export const resolvers = {
  Query: {
    orders: (_parent: unknown, args: { status?: OrderStatus; limit?: number }) =>
      getOrders(args.status, args.limit ?? 50),
    order: (_parent: unknown, args: { id: string }) => getOrder(args.id),
    dashboardMetrics: () => getDashboardMetrics(),
    orderThroughput: (_parent: unknown, args: { days?: number }) =>
      getOrderThroughput(args.days ?? 14),
    inventoryItems: () => getInventoryItems(),
  },

  Mutation: {
    createOrder: (_parent: unknown, args: { input: CreateOrderInput }) => createOrder(args.input),
    retryFulfillment: (_parent: unknown, args: { orderId: string }) =>
      retryFulfillment(args.orderId),
  },

  Order: {
    createdAt: (o: FullOrder) => iso(o.createdAt),
    updatedAt: (o: FullOrder) => iso(o.updatedAt),
    // events are ordered ascending, so the last element is the most recent event.
    lastEvent: (o: FullOrder) => o.events.at(-1) ?? null,
  },

  Payment: {
    createdAt: (p: Payment) => iso(p.createdAt),
  },

  Invoice: {
    createdAt: (i: Invoice) => iso(i.createdAt),
  },

  OrderEvent: {
    createdAt: (e: OrderEvent) => iso(e.createdAt),
    payload: (e: OrderEvent) => JSON.stringify(e.payload),
  },

  FulfillmentJob: {
    createdAt: (j: FulfillmentJob) => iso(j.createdAt),
    updatedAt: (j: FulfillmentJob) => iso(j.updatedAt),
  },
};
