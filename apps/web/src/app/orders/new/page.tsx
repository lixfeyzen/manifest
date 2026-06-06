'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input, Label, Select } from '@/components/Field';
import { formatCurrency } from '@/lib/format';
import { createOrder, fetchInventory } from '@/lib/queries';
import type { InventoryItem } from '@/lib/types';

export default function NewOrderPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [email, setEmail] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingInv, setLoadingInv] = useState(true);

  useEffect(() => {
    fetchInventory()
      .then((items) => {
        setInventory(items);
        if (items[0]) setSku(items[0].sku);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load inventory'))
      .finally(() => setLoadingInv(false));
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
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
          Back-office order
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-ink">
          New manual order
        </h1>
        <p className="mt-1 text-sm text-brand-muted">
          Record an order on a customer&apos;s behalf (phone or wholesale). It starts as{' '}
          <strong>PENDING</strong> until a payment webhook arrives.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="email">Customer email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <Label htmlFor="product">Product</Label>
            <Select
              id="product"
              value={sku}
              disabled={loadingInv}
              onChange={(e) => setSku(e.target.value)}
              className="mt-1 w-full"
            >
              {loadingInv ? (
                <option>Loading products…</option>
              ) : (
                inventory.map((item) => (
                  <option key={item.sku} value={item.sku}>
                    {item.name} ({item.sku}) {formatCurrency(item.unitPrice)}, {item.stock} in stock
                  </option>
                ))
              )}
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-32"
            />
          </div>

          <div className="flex items-center justify-between border-t border-brand-border pt-4">
            <span className="text-sm text-brand-muted">Total</span>
            <span className="font-mono text-lg font-semibold tabular-nums text-brand-ink">
              {formatCurrency(total)}
            </span>
          </div>

          {error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-500/20">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting || !sku || loadingInv} className="w-full">
            {submitting ? 'Creating…' : 'Create order'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
