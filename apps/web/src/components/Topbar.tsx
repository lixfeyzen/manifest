import Link from 'next/link';
import { LogoutButton } from './LogoutButton';

/**
 * Slim top bar. On mobile it shows the brand (the sidebar is hidden); on desktop
 * a context label, plus the signed-in user's email and a sign-out control.
 */
export function Topbar({ email }: { email: string }) {
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
        <span className="hidden text-sm text-brand-muted sm:inline">{email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
