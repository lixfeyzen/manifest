import type { ReactNode } from 'react';

// The single framed-surface primitive for the whole app: a hairline border, a soft
// radius, and no drop shadow. Every card and panel composes from this so radius and
// elevation can never drift between pages. Callers add their own padding.
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-lg border border-brand-border bg-brand-surface ${className}`}>
      {children}
    </div>
  );
}

// Optional divided header (title on the left, an action on the right) for framed panels.
export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-brand-border px-5 py-3.5">
      {typeof title === 'string' ? (
        <h2 className="text-sm font-semibold text-brand-ink">{title}</h2>
      ) : (
        title
      )}
      {action}
    </div>
  );
}
