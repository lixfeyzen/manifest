import Link from 'next/link';

/**
 * Slim top bar. On mobile it shows the brand (the sidebar is hidden); on desktop
 * it shows a context label and a static operator chip so the app reads like a
 * real internal SaaS tool. (No auth by design — see docs/ai-workflow.md.)
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

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-2.5 py-1 text-xs font-medium text-brand-muted ring-1 ring-inset ring-brand-border">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Demo
        </span>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary-soft text-xs font-semibold text-brand-primary-dark">
            OP
          </div>
          <div className="hidden leading-tight sm:block">
            <span className="block text-xs font-medium text-brand-ink">Operator</span>
            <span className="block text-[11px] text-brand-muted">Fulfillment team</span>
          </div>
        </div>
      </div>
    </header>
  );
}
