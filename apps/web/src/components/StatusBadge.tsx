import type { FulfillmentJobStatus, OrderStatus } from '@/lib/types';

// One status presentation across the whole app: a small colour dot + the status
// word. No pill background, no ring — calm and consistent.
type Tone = 'neutral' | 'purple' | 'amber' | 'green' | 'red';

const DOT: Record<Tone, string> = {
  neutral: 'bg-brand-muted',
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

export function StatusLabel({
  label,
  tone,
  className = '',
}: {
  label: string;
  tone: Tone;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium text-brand-ink ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      <span>{label}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <StatusLabel label={status} tone={ORDER_TONE[status]} className="text-xs" />;
}

export function JobStatusBadge({ status }: { status: FulfillmentJobStatus }) {
  return <StatusLabel label={status} tone={JOB_TONE[status]} className="text-xs" />;
}
