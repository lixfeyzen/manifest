export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-40 animate-pulse rounded-lg bg-brand-border" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-brand-border bg-brand-surface"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-brand-border bg-brand-surface" />
    </div>
  );
}
