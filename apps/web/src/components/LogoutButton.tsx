'use client';

import { Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/lib/queries';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await logout();
        router.replace('/login');
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-brand-muted transition-colors hover:bg-brand-surface-2 hover:text-brand-ink disabled:opacity-50"
      title="Sign out"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
