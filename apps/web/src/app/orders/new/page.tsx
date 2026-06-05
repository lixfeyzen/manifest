'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import { createOrder, fetchInventory } from '@/lib/queries';
import type { InventoryItem } from '@/lib/types';

export default function NewOrderPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [email, setEmail] = useState('customer@example.com');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory()
      .then((items) => {
        setInventory(items);
        if (items[0]) setSku(items[0].sku);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load inventory'));
  }, []);

  const selected = inventory.find((i) => i.sku === sku);
  const total = selected ? selected.unitPrice * quantity : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder({ customerEmail: email, items: [{ sku, quantity }] });
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New order</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create an order from seeded inventory. It starts as <strong>PENDING</strong> until a
          payment webhook arrives.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700">Customer email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Product</label>
          <select
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            {inventory.map((item) => (
              <option key={item.sku} value={item.sku}>
                {item.name} ({item.sku}) — {formatCurrency(item.unitPrice)} · {item.stock} in stock
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Quantity</label>
          <input
            type="number"
            min={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-sm text-slate-500">Total</span>
          <span className="text-lg font-semibold tabular-nums text-slate-900">
            {formatCurrency(total)}
          </span>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !sku}
          className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create order'}
        </button>
      </form>
    </div>
  );
}
