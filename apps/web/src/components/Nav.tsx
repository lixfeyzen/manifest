import Link from 'next/link';

export function Nav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            M
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-semibold text-slate-900">Manifest</span>
            <span className="block text-[11px] text-slate-400">Fulfillment Operations</span>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Dashboard
          </Link>
          <Link
            href="/orders"
            className="rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Orders
          </Link>
          <Link
            href="/orders/new"
            className="rounded-md bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700"
          >
            New Order
          </Link>
        </nav>
      </div>
    </header>
  );
}
