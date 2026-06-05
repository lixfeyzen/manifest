import Link from 'next/link';
import { Logo } from './Logo';
import { LogoutButton } from './LogoutButton';
import { MobileNav } from './MobileNav';

/**
 * Slim top bar. On mobile: hamburger (drawer) + brand (the sidebar is hidden).
 * On desktop: a context label. Always: the signed-in user + sign-out.
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
        <span className="hidden text-sm text-brand-muted sm:inline">{email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
