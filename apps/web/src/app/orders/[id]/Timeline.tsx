import { formatDateTime, formatRelative } from '@/lib/format';
import type { OrderEvent } from '@/lib/types';

// Restrained palette: most events are neutral; only meaningful milestones get
// colour, so the eye is drawn to what matters (payment, fulfilled, failed).
const TONE: Record<string, string> = {
  'payment.succeeded': 'bg-brand-primary',
  'order.fulfilled': 'bg-emerald-500',
  'order.failed': 'bg-red-500',
  'duplicate_event.ignored': 'bg-amber-500',
  'fulfillment.retry_requested': 'bg-amber-500',
};

export function Timeline({ events }: { events: OrderEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-brand-muted">No events yet.</p>;
  }
  return (
    <ol>
      {events.map((event, i) => (
        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 && (
            <span className="absolute left-[4.5px] top-3.5 h-full w-px bg-brand-border" />
          )}
          <span
            className={`relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${TONE[event.type] ?? 'bg-brand-chalice'}`}
          />
          <div className="min-w-0 leading-tight">
            <p className="font-mono text-[13px] text-brand-ink">{event.type}</p>
            <p className="mt-0.5 text-xs text-brand-muted" title={formatDateTime(event.createdAt)}>
              {formatRelative(event.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
