'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// One bar per day, segmented by where the day's orders currently sit in the
// fulfillment pipeline — the product's whole premise, made visual.
export interface ChartPoint {
  date: string; // short label, e.g. "05 Jun"
  today: boolean;
  pending: number;
  paid: number;
  fulfilling: number;
  fulfilled: number;
  failed: number;
  total: number;
  hasFailedJob: boolean;
}

const SEGMENTS = [
  { key: 'fulfilled', label: 'Fulfilled', color: '#10B981' },
  { key: 'fulfilling', label: 'Fulfilling', color: '#F59E0B' },
  { key: 'paid', label: 'Paid', color: '#7C5CFC' },
  { key: 'failed', label: 'Failed', color: '#EF4444' },
  { key: 'pending', label: 'Pending', color: '#C4C7CE' },
] as const;

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: ChartPoint }>;
}

function ThroughputTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  const rows = SEGMENTS.map((s) => ({ ...s, value: p[s.key] as number })).filter((r) => r.value > 0);
  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-3 text-xs shadow-md">
      <p className="mb-1.5 font-semibold text-brand-ink">{label}</p>
      {rows.length === 0 && <p className="text-brand-muted">No orders</p>}
      {rows.map((r) => (
        <p key={r.key} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5 text-brand-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            {r.label}
          </span>
          <span className="font-mono tabular-nums text-brand-ink">{r.value}</span>
        </p>
      ))}
      <div className="mt-1.5 flex items-center justify-between border-t border-brand-border pt-1.5">
        <span className="text-brand-muted">Total</span>
        <span className="font-mono font-semibold tabular-nums text-brand-ink">{p.total}</span>
      </div>
    </div>
  );
}

export function OrdersChart({ data }: { data: ChartPoint[] }) {
  // Animate the bars in once, then freeze so the 3s auto-refresh never replays.
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [animate, setAnimate] = useState(!reduced);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(false), 900);
    return () => clearTimeout(t);
  }, []);

  const todayLabel = data.find((d) => d.today)?.date;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid stroke="#E6E8EC" vertical={false} strokeDasharray="2 6" strokeOpacity={0.7} />
        {todayLabel && (
          <ReferenceArea x1={todayLabel} x2={todayLabel} fill="#7C5CFC" fillOpacity={0.05} />
        )}
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tick={{ fontSize: 11, fill: '#6B7280' }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={28}
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickFormatter={(v: number) => (v === 0 ? '' : String(v))}
        />
        <Tooltip cursor={{ fill: 'rgba(124,92,252,0.06)' }} content={<ThroughputTooltip />} />
        {SEGMENTS.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="d"
            fill={s.color}
            radius={i === SEGMENTS.length - 1 ? [3, 3, 0, 0] : undefined}
            isAnimationActive={animate}
            animationBegin={i * 80}
            animationDuration={500}
            animationEasing="ease-out"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
