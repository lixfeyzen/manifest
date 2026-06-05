export default function DashboardLoading() {
  return (
    <div className="space-y-10">
      <div className="h-9 w-40 animate-pulse rounded-lg bg-brand-surface-2" />
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-20 animate-pulse rounded bg-brand-surface-2" />
            <div className="h-8 w-12 animate-pulse rounded bg-brand-surface-2" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-brand-surface-2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-brand-surface-2" />
        ))}
      </div>
    </div>
  );
}
