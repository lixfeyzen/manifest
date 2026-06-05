import type { FulfillmentJobStatus, OrderStatus } from '@/lib/types';

const ORDER_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-brand-bg text-brand-muted ring-brand-border',
  PAID: 'bg-brand-primary-soft text-brand-primary ring-brand-primary/30',
  FULFILLING: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
  FULFILLED: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-400 ring-red-500/20',
};

const JOB_STYLES: Record<FulfillmentJobStatus, string> = {
  QUEUED: 'bg-brand-bg text-brand-muted ring-brand-border',
  PROCESSING: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-400 ring-red-500/20',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ORDER_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function JobStatusBadge({ status }: { status: FulfillmentJobStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${JOB_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
