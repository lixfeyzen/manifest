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

      <span className="font-mono text-xs text-brand-muted">local</span>
    </header>
  );
}
