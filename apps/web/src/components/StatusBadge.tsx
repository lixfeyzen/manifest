import type { FulfillmentJobStatus, OrderStatus } from '@/lib/types';

const ORDER_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700 ring-slate-200',
  PAID: 'bg-blue-50 text-blue-700 ring-blue-200',
  FULFILLING: 'bg-amber-50 text-amber-700 ring-amber-200',
  FULFILLED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FAILED: 'bg-red-50 text-red-700 ring-red-200',
};

const JOB_STYLES: Record<FulfillmentJobStatus, string> = {
  QUEUED: 'bg-slate-100 text-slate-700 ring-slate-200',
  PROCESSING: 'bg-amber-50 text-amber-700 ring-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FAILED: 'bg-red-50 text-red-700 ring-red-200',
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
