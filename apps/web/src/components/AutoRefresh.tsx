'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  );
}
