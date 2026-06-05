function shimmer(extra = '') {
  return `animate-pulse rounded bg-brand-surface-2 ${extra}`;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className={shimmer('h-8 w-40 rounded-lg')} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-brand-border bg-brand-surface p-5">
            <div className={shimmer('h-4 w-20')} />
            <div className={shimmer('h-8 w-12')} />
            <div className={shimmer('h-3 w-16')} />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
        <div className="mb-3 space-y-1.5">
          <div className={shimmer('h-4 w-28')} />
          <div className={shimmer('h-3 w-44')} />
        </div>
        <div className={shimmer('h-[240px] w-full')} />
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border border-brand-border bg-brand-surface">
        <div className="border-b border-brand-border px-5 py-3.5">
          <div className={shimmer('h-4 w-28')} />
        </div>
        <div className="divide-y divide-brand-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5">
              <div className="space-y-2">
                <div className={shimmer('h-3.5 w-24')} />
                <div className={shimmer('h-3 w-32')} />
              </div>
              <div className={shimmer('h-5 w-20 rounded-full')} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
