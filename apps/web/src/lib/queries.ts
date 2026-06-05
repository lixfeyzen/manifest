import { API_URL, graphqlRequest } from './graphql';
import type { DashboardMetrics, InventoryItem, Order, OrderStatus } from './types';

const ORDER_FIELDS = `
  id
  customerEmail
  totalAmount
  status
  createdAt
  updatedAt
  items { id sku name quantity unitPrice }
  payment { id amount status providerEventId createdAt }
  invoice { id invoiceNumber amount status createdAt }
  fulfillmentJobs { id status attempts lastError bullJobId createdAt updatedAt }
  events { id type payload correlationId createdAt }
  lastEvent { id type createdAt }
`;

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const data = await graphqlRequest<{ dashboardMetrics: DashboardMetrics }>(`
    query { dashboardMetrics { totalOrders pendingOrders paidOrders fulfilledOrders failedJobs } }
  `);
  return data.dashboardMetrics;
}

export async function fetchOrders(status?: OrderStatus): Promise<Order[]> {
  const data = await graphqlRequest<{ orders: Order[] }>(
    `query Orders($status: OrderStatus) { orders(status: $status) { ${ORDER_FIELDS} } }`,
    { status },
  );
  return data.orders;
}

export async function fetchOrder(id: string): Promise<Order | null> {
  const data = await graphqlRequest<{ order: Order | null }>(
    `query Order($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`,
    { id },
  );
  return data.order;
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  const data = await graphqlRequest<{ inventoryItems: InventoryItem[] }>(`
    query { inventoryItems { id sku name stock unitPrice } }
  `);
  return data.inventoryItems;
}

export interface CreateOrderInput {
  customerEmail: string;
  items: Array<{ sku: string; quantity: number }>;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const data = await graphqlRequest<{ createOrder: Order }>(
    `mutation Create($input: CreateOrderInput!) { createOrder(input: $input) { id } }`,
    { input },
  );
  return data.createOrder;
}

export interface RetryResult {
  ok: boolean;
  message: string;
  status: OrderStatus;
}

export async function retryFulfillment(orderId: string): Promise<RetryResult> {
  const data = await graphqlRequest<{ retryFulfillment: RetryResult }>(
    `mutation Retry($orderId: ID!) { retryFulfillment(orderId: $orderId) { ok message status } }`,
    { orderId },
  );
  return data.retryFulfillment;
}

/**
 * Send a simulated payment webhook to the REST endpoint.
 *
 * The idempotencyKey is deterministic (`payment_<orderId>_demo`) so that the
 * "Simulate Duplicate" button can re-send the exact same event and demonstrate
 * idempotent handling.
 */
export async function sendPaymentWebhook(params: {
  orderId: string;
  amount: number;
  duplicate?: boolean;
}): Promise<{ status: string; message: string }> {
  const { orderId, amount, duplicate } = params;
  const res = await fetch(`${API_URL}/webhooks/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId: `evt_${orderId}_demo`,
      orderId,
      type: 'payment.succeeded',
      amount,
      idempotencyKey: `payment_${orderId}_demo`,
      correlationId: `corr_${orderId}_${duplicate ? 'dup' : 'first'}`,
    }),
  });
  return (await res.json()) as { status: string; message: string };
}
