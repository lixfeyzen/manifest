/** Format an integer rupiah amount (e.g. 120000 → "Rp 120.000"). */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format an ISO timestamp into a readable local date-time. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short order id for display (first 8 chars). */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

/**
 * Derive a human display name from an email's local part:
 * "olivia.martin@gmail.com" → "Olivia Martin". Falls back to the email.
 */
export function formatCustomerName(email: string): string {
  const local = email.split('@')[0] ?? '';
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
  return name || email;
}

/**
 * Human-relative time ("just now", "5m ago", "3h ago"). Computed at render time;
 * pair it with the absolute time in a title attribute for precision on hover.
 */
export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(diffMs / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
