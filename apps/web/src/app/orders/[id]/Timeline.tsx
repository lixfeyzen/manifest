import { formatDateTime } from '@/lib/format';
import type { OrderEvent } from '@/lib/types';

// Color hint per event type so the timeline is scannable at a glance.
const DOT: Record<string, string> = {
  'order.created': 'bg-slate-400',
  'payment.webhook.received': 'bg-blue-400',
  'payment.succeeded': 'bg-blue-500',
  'duplicate_event.ignored': 'bg-amber-400',
  'fulfillment.queued': 'bg-indigo-400',
  'fulfillment.started': 'bg-indigo-500',
  'inventory.reserved': 'bg-violet-500',
  'invoice.generated': 'bg-violet-600',
  'order.fulfilled': 'bg-emerald-500',
  'order.failed': 'bg-red-500',
  'fulfillment.retry_requested': 'bg-amber-500',
};

export function Timeline({ events }: { events: OrderEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-400">No events yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
              DOT[event.type] ?? 'bg-slate-300'
            }`}
          />
          <p className="font-mono text-sm text-slate-800">{event.type}</p>
          <p className="text-xs text-slate-400">{formatDateTime(event.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}
