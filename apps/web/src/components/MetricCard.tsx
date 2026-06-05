// A single metric: muted label + large number. Intentionally not a card — the
// dashboard groups these into one calm row separated by hairlines.
export function MetricCard({
  label,
  value,
  accent = 'ink',
}: {
  label: string;
  value: number;
  accent?: 'ink' | 'red';
}) {
  return (
    <div>
      <p className="text-sm text-brand-muted">{label}</p>
      <p
        className={`mt-1.5 text-3xl font-semibold tabular-nums tracking-tight ${
          accent === 'red' && value > 0 ? 'text-red-600' : 'text-brand-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
