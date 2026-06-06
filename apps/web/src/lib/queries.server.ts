import 'server-only';
import { cookies } from 'next/headers';
import {
  API_URL,
  DASHBOARD_QUERY,
  ORDERS_QUERY,
  ORDER_QUERY,
  THROUGHPUT_QUERY,
  graphqlRequest,
} from './graphql';
import type { AuthUser } from './queries';
import type { DashboardMetrics, Order, OrderListItem, OrderStatus, ThroughputDay } from './types';

// Server-only data fetchers. A Server Component's fetch does not automatically
// carry the browser's cookies, so we read them via next/headers and forward the
// session cookie to the API.
async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store.toString();
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const data = await graphqlRequest<{ dashboardMetrics: DashboardMetrics }>(
    DASHBOARD_QUERY,
    undefined,
    await cookieHeader(),
  );
  return data.dashboardMetrics;
}

export async function fetchOrders(status?: OrderStatus, limit = 50): Promise<OrderListItem[]> {
  const data = await graphqlRequest<{ orders: OrderListItem[] }>(
    ORDERS_QUERY,
    { status, limit },
    await cookieHeader(),
  );
  return data.orders;
}

export async function fetchThroughput(days = 14): Promise<ThroughputDay[]> {
  const data = await graphqlRequest<{ orderThroughput: ThroughputDay[] }>(
    THROUGHPUT_QUERY,
    { days },
    await cookieHeader(),
  );
  return data.orderThroughput;
}

export async function fetchOrder(id: string): Promise<Order | null> {
  const data = await graphqlRequest<{ order: Order | null }>(
    ORDER_QUERY,
    { id },
    await cookieHeader(),
  );
  return data.order;
}

/**
 * Resolve the logged-in user for the layout. Returns null (never throws) when
 * unauthenticated or the API is unreachable, so the shell renders regardless.
 */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: await cookieHeader() },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { user: AuthUser | null };
    return json.user;
  } catch {
    return null;
  }
}
