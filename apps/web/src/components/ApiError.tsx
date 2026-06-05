import { API_URL } from '@/lib/graphql';

export function ApiError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
      <h2 className="text-sm font-semibold text-red-300">Could not reach the Manifest API</h2>
      <p className="mt-1 text-sm text-red-300">{message}</p>
      <p className="mt-3 text-xs text-red-400">
        Expected the API at <code className="font-mono">{API_URL}</code>. Make sure the API and
        worker are running (<code className="font-mono">pnpm dev</code>) and Postgres/Redis are up
        (<code className="font-mono">docker compose up -d</code>).
      </p>
    </div>
  );
}
