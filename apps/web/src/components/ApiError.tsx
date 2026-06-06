import { API_URL } from '@/lib/graphql';

export function ApiError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // Developer setup hints belong in local dev only, not in the operator-facing product.
  const showDevHint = process.env.NODE_ENV !== 'production';
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6">
      <h2 className="text-sm font-semibold text-red-700">Could not reach the Manifest API</h2>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      {showDevHint && (
        <p className="mt-3 text-xs text-red-600">
          Expected the API at <code className="font-mono">{API_URL}</code>. Make sure the API and
          worker are running (<code className="font-mono">pnpm dev</code>) and Postgres/Redis are up
          (<code className="font-mono">docker compose up -d</code>).
        </p>
      )}
    </div>
  );
}
