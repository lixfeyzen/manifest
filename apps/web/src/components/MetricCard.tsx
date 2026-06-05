import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

type HintTone = 'good' | 'bad' | 'muted';
type Tone = 'violet' | 'amber' | 'blue' | 'emerald' | 'red' | 'neutral';

const CHIP: Record<Tone, string> = {
  violet: 'bg-brand-primary-soft text-brand-primary',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  neutral: 'bg-brand-surface-2 text-brand-muted',
};

const HINT: Record<HintTone, string> = {
  good: 'text-emerald-600',
  bad: 'text-red-600',
  muted: 'text-brand-muted',
};

// KPI card: label + a colour icon chip + a large number, with an optional
// contextual hint. The chip gives each metric a fresh, distinct accent.
export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: { text: string; tone: HintTone; dir?: 'up' | 'down' };
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm transition-[transform,box-shadow] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-muted">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${CHIP[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-brand-ink">
        {value}
      </p>
      {hint && (
        <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${HINT[hint.tone]}`}>
          {hint.dir === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
          {hint.dir === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
          {hint.text}
        </p>
      )}
    </div>
  );
}
