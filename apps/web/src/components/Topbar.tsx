import Link from 'next/link';
import { Logo } from './Logo';
import { LogoutButton } from './LogoutButton';
import { MobileNav } from './MobileNav';

/**
 * Slim top bar. On mobile it carries the hamburger (drawer) + brand, since the
 * sidebar is hidden there. On desktop the sidebar carries identity, so the bar
 * just holds the signed-in user + sign-out on the right.
 */
export function Topbar({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-brand-border bg-brand-bg/80 px-4 backdrop-blur lg:px-10">
      <div className="flex items-center gap-2">
        <MobileNav />
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <Logo className="h-6 w-6 text-brand-primary" />
          <span className="text-sm font-semibold tracking-tight text-brand-ink">Manifest</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 sm:flex">
          <span className="rounded bg-brand-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-brand-muted">
            Operator
          </span>
          <span className="text-sm text-brand-muted">{email}</span>
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
