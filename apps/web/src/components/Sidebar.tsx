'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, type LucideIcon, PlusCircle, ShoppingCart } from 'lucide-react';
import { Wordmark } from './Logo';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/orders/new', label: 'New Order', icon: PlusCircle },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/orders/new') return pathname === '/orders/new';
  // Orders matches /orders and /orders/[id], but not /orders/new.
  return pathname.startsWith('/orders') && pathname !== '/orders/new';
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-brand-border bg-brand-surface lg:flex">
      <div className="flex h-16 items-center border-b border-brand-border px-5">
        <Wordmark />
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
          Menu
        </p>
        {NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
      </nav>
    </aside>
  );
}
