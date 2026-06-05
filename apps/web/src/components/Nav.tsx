import Link from 'next/link';

export function Nav() {
  return (
    <header className="border-b border-brand-border bg-brand-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-sm font-bold text-white shadow-sm shadow-brand-primary/30">
            M
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-semibold text-brand-ink">Manifest</span>
            <span className="block text-[11px] text-brand-muted">Fulfillment Operations</span>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-md px-3 py-2 font-medium text-brand-muted hover:bg-brand-bg hover:text-brand-ink"
          >
            Dashboard
          </Link>
          <Link
            href="/orders"
            className="rounded-md px-3 py-2 font-medium text-brand-muted hover:bg-brand-bg hover:text-brand-ink"
          >
            Orders
          </Link>
          <Link
            href="/orders/new"
            className="rounded-md bg-brand-primary px-3 py-2 font-medium text-white shadow-sm shadow-brand-primary/30 hover:bg-brand-primary-dark"
          >
            New Order
          </Link>
        </nav>
      </div>
    </header>
  );
}
