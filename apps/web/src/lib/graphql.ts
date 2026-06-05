/** Base URL of the Manifest API (REST + GraphQL). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Minimal GraphQL client, usable from both client and server components.
 *
 * - In the browser, `credentials: 'include'` sends the session cookie.
 * - In a Server Component, the browser cookie is NOT auto-attached, so callers
 *   pass `cookieHeader` (read from next/headers) to forward the session. This
 *   file stays free of `next/headers` so it remains safe to import on the client.
 */
export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  cookieHeader?: string,
): Promise<T> {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    credentials: 'include',
  });

  if (!res.ok) {
    const err = new Error(`API request failed: ${res.status} ${res.statusText}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(json.errors[0]!.message);
  }
  if (!json.data) {
    throw new Error('No data returned from API');
  }
  return json.data;
}

/** GraphQL field selection shared by the order queries (client + server). */
export const ORDER_FIELDS = `
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

export const ORDERS_QUERY = `query Orders($status: OrderStatus) { orders(status: $status) { ${ORDER_FIELDS} } }`;
export const ORDER_QUERY = `query Order($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`;
export const DASHBOARD_QUERY = `query { dashboardMetrics { totalOrders pendingOrders paidOrders fulfilledOrders failedJobs } }`;
