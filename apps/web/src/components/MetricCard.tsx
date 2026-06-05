export function MetricCard({
  label,
  value,
  accent = 'ink',
}: {
  label: string;
  value: number;
  accent?: 'ink' | 'primary' | 'emerald' | 'muted' | 'red';
}) {
  const accents: Record<string, string> = {
    ink: 'text-brand-ink',
    primary: 'text-brand-primary',
    emerald: 'text-emerald-600',
    muted: 'text-brand-muted',
    red: 'text-red-500',
  };
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm">
      <p className="text-sm font-medium text-brand-muted">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${accents[accent]}`}>{value}</p>
    </div>
  );
}
