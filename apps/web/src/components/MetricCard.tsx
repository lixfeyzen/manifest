import type { LucideIcon } from 'lucide-react';

type HintTone = 'good' | 'bad' | 'muted';

const HINT: Record<HintTone, string> = {
  good: 'text-emerald-600',
  bad: 'text-red-600',
  muted: 'text-brand-muted',
};

// KPI card, "Linear-quiet" style: an uppercase eyebrow label, a small neutral
// icon, a confident mono number, and a subline that EVERY card carries so the row
// stays perfectly even. Colour is reserved for meaning only: an `alert` card tints
// red, and the subline reads good / bad / muted. No per-card decorative colours,
// no drop shadow: structure comes from a hairline border.
export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  alert = false,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  hint: { text: string; tone: HintTone };
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-4 transition-colors duration-150 ease-[var(--ease-out)] hover:border-brand-chalice">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-muted">{label}</p>
        <Icon className={`h-4 w-4 ${alert ? 'text-red-500' : 'text-brand-muted'}`} />
      </div>
      <p
        className={`mt-3 font-mono text-[28px] font-semibold leading-none tracking-tight tabular-nums ${
          alert ? 'text-red-600' : 'text-brand-ink'
        }`}
      >
        {value}
      </p>
      <p className={`mt-2 text-xs font-medium ${HINT[hint.tone]}`}>{hint.text}</p>
    </div>
  );
}
