'use client';

import { eventMeta } from '@/lib/events';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { OrderEvent } from '@/lib/types';

export function Timeline({ events }: { events: OrderEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-brand-muted">No events yet.</p>;
  }
  return (
    <ol>
      {events.map((event, i) => (
        <li
          key={event.id}
          className="mf-rise relative flex gap-3 pb-4 last:pb-0"
          style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
        >
          {i < events.length - 1 && (
            <span className="absolute left-[4.5px] top-3.5 h-full w-px bg-brand-border" />
          )}
          <span
            className={`relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${eventMeta(event.type).dot}`}
          />
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] font-medium text-brand-ink" title={event.type}>
              {eventMeta(event.type).label}
            </p>
            <p className="mt-0.5 text-xs text-brand-muted" title={formatDateTime(event.createdAt)}>
              {formatRelative(event.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
