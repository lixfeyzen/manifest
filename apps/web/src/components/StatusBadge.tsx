import type { FulfillmentJobStatus, OrderStatus } from '@/lib/types';

const ORDER_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-brand-bg text-brand-muted ring-brand-border',
  PAID: 'bg-brand-primary-soft text-brand-primary-dark ring-brand-primary/20',
  FULFILLING: 'bg-amber-50 text-amber-700 ring-amber-200',
  FULFILLED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FAILED: 'bg-red-50 text-red-600 ring-red-200',
};

const JOB_STYLES: Record<FulfillmentJobStatus, string> = {
  QUEUED: 'bg-brand-bg text-brand-muted ring-brand-border',
  PROCESSING: 'bg-amber-50 text-amber-700 ring-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FAILED: 'bg-red-50 text-red-600 ring-red-200',
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
