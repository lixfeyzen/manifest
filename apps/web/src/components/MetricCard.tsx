import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

type Tone = 'good' | 'bad' | 'muted';

const HINT_STYLES: Record<Tone, string> = {
  good: 'text-emerald-600',
  bad: 'text-red-600',
  muted: 'text-brand-muted',
};

// A shadcn-style KPI card: bordered white card with a label, a large number, and
// an optional small contextual hint (trend/share) so the number tells a story.
export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: { text: string; tone: Tone; dir?: 'up' | 'down' };
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm transition-[transform,box-shadow] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:shadow-md">
      <p className="text-sm font-medium text-brand-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-brand-ink">
        {value}
      </p>
      {hint && (
        <p className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${HINT_STYLES[hint.tone]}`}>
          {hint.dir === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
          {hint.dir === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
          {hint.text}
        </p>
      )}
    </div>
  );
}
