import Link from 'next/link';

/**
 * Slim top bar. On mobile it shows the brand (the sidebar is hidden); on desktop
 * it shows a context label and an honest local-environment indicator.
 */
export function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-brand-border bg-brand-bg/80 px-6 backdrop-blur lg:px-10">
      <Link href="/" className="flex items-center gap-2 lg:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary text-xs font-bold text-white">
          M
        </span>
        <span className="text-sm font-semibold text-brand-ink">Manifest</span>
      </Link>

      <p className="hidden text-sm text-brand-muted lg:block">Fulfillment Operations</p>

      <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-border bg-brand-surface px-2.5 py-1 font-mono text-xs text-brand-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        local
      </span>
    </header>
  );
}
