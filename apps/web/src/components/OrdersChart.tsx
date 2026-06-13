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
import type { ThroughputDay } from '@/lib/types';

// Recharts needs string colours, so these mirror the brand tokens / StatusBadge
// dots exactly (paid = brand primary #6A47E8, pending = chalice): the chart can
// never show a different violet from the rest of the app.
const SEGMENTS = [
  { key: 'fulfilled', label: 'Fulfilled', color: '#10b981' },
  { key: 'fulfilling', label: 'Fulfilling', color: '#f59e0b' },
  { key: 'paid', label: 'Paid', color: '#6a47e8' },
  { key: 'failed', label: 'Failed', color: '#ef4444' },
  { key: 'pending', label: 'Pending', color: '#c4c7ce' },
] as const;

const AXIS = '#5f6b7a'; // brand-muted
const GRID = '#e6e8ec'; // brand-border
const ACCENT = '#6a47e8'; // brand-primary

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: ThroughputDay }>;
}

function ThroughputTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  const rows = SEGMENTS.map((s) => ({ ...s, value: p[s.key] as number })).filter(
    (r) => r.value > 0,
  );
  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-3 text-xs">
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

/** Always-visible legend so the segment colours are decodable without hovering. */
function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {SEGMENTS.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-brand-muted">
          <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function OrdersChart({ data }: { data: ThroughputDay[] }) {
  // Animate the bars in once, then freeze so the 3s auto-refresh never replays.
  // Initial state is constant on both server and client to avoid a hydration
  // mismatch; the reduced-motion check runs in an effect after mount.
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimate(false);
      return;
    }
    const t = setTimeout(() => setAnimate(false), 900);
    return () => clearTimeout(t);
  }, []);

  const todayLabel = data.find((d) => d.today)?.date;
  const totalAll = data.reduce((sum, d) => sum + d.total, 0);
  const failedAll = data.reduce((sum, d) => sum + d.failed, 0);

  // Low-data state: an empty axis reads as "broken", so show a graceful message.
  if (totalAll === 0) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-brand-ink">No throughput yet</p>
        <p className="text-xs text-brand-muted">
          Orders from the last {data.length} days will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        role="img"
        aria-label={`Throughput, last ${data.length} days: ${totalAll} orders, ${failedAll} failed`}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            barCategoryGap="18%"
          >
            <CartesianGrid
              stroke={GRID}
              vertical={false}
              strokeDasharray="2 6"
              strokeOpacity={0.7}
            />
            {todayLabel && (
              <ReferenceArea x1={todayLabel} x2={todayLabel} fill={ACCENT} fillOpacity={0.05} />
            )}
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tick={{ fontSize: 11, fill: AXIS }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fontSize: 11, fill: AXIS }}
              tickFormatter={(v: number) => (v === 0 ? '' : String(v))}
            />
            <Tooltip cursor={{ fill: 'rgba(106,71,232,0.06)' }} content={<ThroughputTooltip />} />
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
      </div>
      <Legend />
    </>
  );
}
