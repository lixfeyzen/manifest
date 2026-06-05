'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tooltip } from './Tooltip';

/**
 * Periodically re-fetches the current Server Component tree via router.refresh(),
 * so an operations view reflects async backend changes (e.g. an order moving to
 * FULFILLED) without a manual reload. Pauses while the tab is hidden to avoid
 * needless requests. Renders a small "Live" indicator.
 */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return (
    <Tooltip label={`Auto-refreshing every ${Math.round(intervalMs / 1000)}s`}>
      <span
        aria-label={`Live — auto-refreshing every ${Math.round(intervalMs / 1000)} seconds`}
        className="inline-flex items-center gap-1.5 text-xs text-brand-muted"
      >
        <span className="mf-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live
      </span>
    </Tooltip>
  );
}
