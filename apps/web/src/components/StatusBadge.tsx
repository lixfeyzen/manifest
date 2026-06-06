import { formatStatus } from '@/lib/format';
import type { FulfillmentJobStatus, OrderStatus } from '@/lib/types';

// A quiet status pill: one neutral background for every status, with a single
// colour dot carrying the meaning (grey = waiting, violet = paid, amber = working,
// green = done, red = failed). This keeps the "colour only for meaning" rule the
// dashboard establishes, instead of five different coloured chips.
type Tone = 'neutral' | 'purple' | 'amber' | 'green' | 'red';

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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface-2 px-2.5 py-0.5 text-xs font-medium text-brand-ink">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      <span>{label}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <StatusLabel label={formatStatus(status)} tone={ORDER_TONE[status]} />;
}

export function JobStatusBadge({ status }: { status: FulfillmentJobStatus }) {
  return <StatusLabel label={formatStatus(status)} tone={JOB_TONE[status]} />;
}
