import type { FulfillmentJobStatus, OrderStatus } from '@/lib/types';

// shadcn-style soft pill: subtle tinted background + a colour dot + the label.
type Tone = 'neutral' | 'purple' | 'amber' | 'green' | 'red';

const PILL: Record<Tone, string> = {
  neutral: 'bg-brand-surface-2 text-brand-muted',
  purple: 'bg-brand-primary-soft text-brand-primary-dark',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
};

const DOT: Record<Tone, string> = {
  neutral: 'bg-brand-chalice',
  purple: 'bg-brand-primary',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
};

const ORDER_TONE: Record<OrderStatus, Tone> = {
  PENDING: 'neutral',
  PAID: 'purple',
  FULFILLING: 'amber',
  FULFILLED: 'green',
  FAILED: 'red',
};

const JOB_TONE: Record<FulfillmentJobStatus, Tone> = {
  QUEUED: 'neutral',
  PROCESSING: 'amber',
  COMPLETED: 'green',
  FAILED: 'red',
};

export function StatusLabel({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 ease-[var(--ease-std)] ${PILL[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      <span>{label}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <StatusLabel label={status} tone={ORDER_TONE[status]} />;
}

export function JobStatusBadge({ status }: { status: FulfillmentJobStatus }) {
  return <StatusLabel label={status} tone={JOB_TONE[status]} />;
}
