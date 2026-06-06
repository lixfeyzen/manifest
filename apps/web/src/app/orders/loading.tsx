export default function OrdersLoading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-brand-surface-2" />
      <div className="flex gap-5 border-b border-brand-border pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-16 animate-pulse rounded bg-brand-surface-2" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-brand-surface-2" />
        ))}
      </div>
    </div>
  );
}
