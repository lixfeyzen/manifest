'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, type LucideIcon, PlusCircle, ShoppingCart } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/orders/new', label: 'New Order', icon: PlusCircle },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/orders/new') return pathname === '/orders/new';
  // Orders matches /orders and /orders/[id], but not /orders/new.
  return pathname.startsWith('/orders') && pathname !== '/orders/new';
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-brand-border bg-brand-surface lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-brand-border px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-sm font-bold text-white shadow-sm shadow-brand-primary/30">
          M
        </span>
        <div className="leading-tight">
          <span className="block text-sm font-semibold text-brand-ink">Manifest</span>
          <span className="block text-[11px] text-brand-muted">Fulfillment Ops</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
          Menu
        </p>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-primary-soft text-brand-primary-dark'
                  : 'text-brand-muted hover:bg-brand-bg hover:text-brand-ink'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-brand-border p-4">
        <div className="rounded-lg bg-brand-bg p-3">
          <p className="text-xs font-medium text-brand-ink">Event-driven fulfillment</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-brand-muted">
            Idempotent webhooks · retry-safe jobs
          </p>
        </div>
      </div>
    </aside>
  );
}
