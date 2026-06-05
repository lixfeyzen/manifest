export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-brand-border" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-brand-border" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-brand-border bg-brand-surface" />
    </div>
  );
}
