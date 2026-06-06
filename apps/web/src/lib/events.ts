// Human-friendly labels plus a colour dot for each order event type, so the UI
// reads "Payment confirmed" instead of the raw "payment.succeeded".
//
// Colour discipline: dots are neutral by default and only carry colour where it
// means something. Green marks a successful outcome, red a failure, amber an event
// that needs attention (a duplicate or a retry). Everything else stays neutral.
interface EventMeta {
  label: string;
  dot: string;
}

const EVENT_META: Record<string, EventMeta> = {
  'order.created': { label: 'Order created', dot: 'bg-brand-chalice' },
  'payment.webhook.received': { label: 'Payment received', dot: 'bg-brand-chalice' },
  'payment.succeeded': { label: 'Payment confirmed', dot: 'bg-brand-chalice' },
  'duplicate_event.ignored': { label: 'Duplicate ignored', dot: 'bg-amber-500' },
  'fulfillment.queued': { label: 'Queued for fulfillment', dot: 'bg-brand-chalice' },
  'fulfillment.started': { label: 'Fulfillment started', dot: 'bg-brand-chalice' },
  'inventory.reserved': { label: 'Inventory reserved', dot: 'bg-brand-chalice' },
  'invoice.generated': { label: 'Invoice issued', dot: 'bg-brand-chalice' },
  'order.fulfilled': { label: 'Order fulfilled', dot: 'bg-emerald-500' },
  'order.failed': { label: 'Order failed', dot: 'bg-red-500' },
  'fulfillment.retry_requested': { label: 'Retry requested', dot: 'bg-amber-500' },
};

export function eventMeta(type: string): EventMeta {
  return EVENT_META[type] ?? { label: type, dot: 'bg-brand-chalice' };
}
