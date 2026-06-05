/** Base URL of the Manifest API (REST + GraphQL). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Minimal GraphQL client. Works in both server and client components (fetch is
 * universal). Always fetches fresh data — this is an operations dashboard, so we
 * never want a stale cache hiding the latest order state.
 */
export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
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
