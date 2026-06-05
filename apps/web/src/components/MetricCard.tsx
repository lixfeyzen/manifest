import type { LucideIcon } from 'lucide-react';

type Accent = 'ink' | 'primary' | 'emerald' | 'muted' | 'red';

const ICON_STYLES: Record<Accent, string> = {
  ink: 'bg-brand-bg text-brand-ink',
  primary: 'bg-brand-primary-soft text-brand-primary',
  emerald: 'bg-emerald-50 text-emerald-600',
  muted: 'bg-brand-bg text-brand-muted',
  red: 'bg-red-50 text-red-500',
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  accent = 'ink',
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: Accent;
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-muted">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ICON_STYLES[accent]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-brand-ink">{value}</p>
    </div>
  );
}
