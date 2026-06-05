'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV, isNavActive } from './Sidebar';
import { Wordmark } from './Logo';

/**
 * Mobile navigation: a hamburger that opens a slide-over drawer. The desktop
 * sidebar is hidden below `lg`, so this is the only way to navigate on small
 * screens. Closes on route change.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-muted hover:bg-brand-surface-2 hover:text-brand-ink"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-brand-ink/30 backdrop-blur-sm"
          />
          <nav className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-brand-border bg-brand-surface p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Wordmark />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted hover:bg-brand-surface-2 hover:text-brand-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {NAV.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                      active
                        ? 'bg-brand-surface-2 text-brand-ink'
                        : 'text-brand-muted hover:bg-brand-surface-2 hover:text-brand-ink'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
