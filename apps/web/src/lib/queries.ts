import { API_URL, graphqlRequest } from './graphql';
import type { InventoryItem, Order, OrderStatus } from './types';

// Client-side data functions. In the browser, the session cookie is sent
// automatically (graphqlRequest uses credentials:'include'). Server Components
// must use ./queries.server instead, which forwards the cookie explicitly.

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
 * Send a simulated payment webhook to the (public) REST endpoint. The
 * idempotencyKey is deterministic so "Simulate Duplicate" re-sends the same event.
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

// --- Auth (REST) ------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
}

async function authRequest(
  path: '/auth/login' | '/auth/register',
  body: { email: string; password: string },
): Promise<AuthUser> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const json = (await res.json().catch(() => ({}))) as { user?: AuthUser; error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? 'Authentication failed');
  }
  return json.user!;
}

export const login = (email: string, password: string) => authRequest('/auth/login', { email, password });
export const register = (email: string, password: string) =>
  authRequest('/auth/register', { email, password });

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
}
