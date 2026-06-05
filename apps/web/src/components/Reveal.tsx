'use client';

import { useEffect, useState } from 'react';

/**
 * Plays a one-time rise/fade entrance on initial mount only. Because a client
 * component instance is preserved (reconciled, not remounted) across a Server
 * Component `router.refresh()`, the effect runs once — so the dashboard's 3s
 * auto-refresh never re-triggers the animation. Reduced-motion is handled by the
 * global CSS kill-switch (duration collapses to ~0, snapping to final state).
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <div
      className={className}
      style={on ? { animation: `mf-rise 0.18s var(--ease-out) ${delay}ms both` } : { opacity: 0 }}
    >
      {children}
    </div>
  );
}
