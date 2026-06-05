'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface ChartPoint {
  date: string; // short label, e.g. "Jun 5"
  orders: number;
}

// Area chart of orders created per day. Client component (recharts needs the DOM).
export function OrdersChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: '#6B7280' }}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={28}
          tick={{ fontSize: 11, fill: '#6B7280' }}
        />
        <Tooltip
          cursor={{ stroke: '#E6E8EC' }}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #E6E8EC',
            fontSize: 12,
            boxShadow: '0 4px 12px rgb(0 0 0 / 0.06)',
          }}
          labelStyle={{ color: '#18181B', fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="orders"
          stroke="#7C5CFC"
          strokeWidth={2}
          fill="url(#ordersFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
