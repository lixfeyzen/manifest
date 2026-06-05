export function MetricCard({
  label,
  value,
  accent = 'slate',
}: {
  label: string;
  value: number;
  accent?: 'slate' | 'blue' | 'emerald' | 'amber' | 'red';
}) {
  const accents: Record<string, string> = {
    slate: 'text-slate-900',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${accents[accent]}`}>{value}</p>
    </div>
  );
}
