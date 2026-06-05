// Human-friendly labels + a colour dot for each order event type — so the UI
// reads "Payment confirmed" instead of the raw "payment.succeeded".
interface EventMeta {
  label: string;
  dot: string;
}

const EVENT_META: Record<string, EventMeta> = {
  'order.created': { label: 'Order created', dot: 'bg-brand-muted' },
  'payment.webhook.received': { label: 'Payment received', dot: 'bg-blue-500' },
  'payment.succeeded': { label: 'Payment confirmed', dot: 'bg-brand-primary' },
  'duplicate_event.ignored': { label: 'Duplicate ignored', dot: 'bg-amber-500' },
  'fulfillment.queued': { label: 'Queued for fulfillment', dot: 'bg-indigo-500' },
  'fulfillment.started': { label: 'Fulfillment started', dot: 'bg-indigo-500' },
  'inventory.reserved': { label: 'Inventory reserved', dot: 'bg-violet-500' },
  'invoice.generated': { label: 'Invoice issued', dot: 'bg-violet-600' },
  'order.fulfilled': { label: 'Order fulfilled', dot: 'bg-emerald-500' },
  'order.failed': { label: 'Order failed', dot: 'bg-red-500' },
  'fulfillment.retry_requested': { label: 'Retry requested', dot: 'bg-amber-500' },
};

export function eventMeta(type: string): EventMeta {
  return EVENT_META[type] ?? { label: type, dot: 'bg-brand-chalice' };
}
