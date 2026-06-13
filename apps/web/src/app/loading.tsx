function shimmer(extra = '') {
  return `animate-pulse rounded bg-brand-surface-2 ${extra}`;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header: mirror the real title + subtitle + Live pill so there's no jump */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className={shimmer('h-7 w-40')} />
          <div className={shimmer('h-3 w-64')} />
        </div>
        <div className={shimmer('h-4 w-14 rounded-full')} />
      </div>

      {/* KPI cards: must match the resolved grid exactly (gap-3, rounded-lg, p-4) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-brand-border bg-brand-surface p-4">
            <div className="flex items-center justify-between">
              <div className={shimmer('h-3 w-16')} />
              <div className={shimmer('h-4 w-4')} />
            </div>
            <div className={shimmer('mt-3 h-7 w-10')} />
            <div className={shimmer('mt-2 h-3 w-14')} />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-brand-border bg-brand-surface">
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-3.5">
          <div className={shimmer('h-4 w-28')} />
          <div className={shimmer('h-3 w-20')} />
        </div>
        <div className="p-5">
          <div className={shimmer('h-[240px] w-full')} />
        </div>
      </div>

      {/* Recent orders */}
      <div className="rounded-lg border border-brand-border bg-brand-surface">
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-3.5">
          <div className={shimmer('h-4 w-28')} />
          <div className={shimmer('h-3 w-16')} />
        </div>
        <div className="divide-y divide-brand-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
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
