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
