"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface DailyRevenue {
  date: string;
  revenue: number;
}

interface VendorRevenueChartProps {
  data: DailyRevenue[];
}

export function VendorRevenueChart({ data }: VendorRevenueChartProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">Revenue (Last 30 days)</p>
          <h2 className="mt-2 text-2xl font-semibold text-text">Daily earnings</h2>
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
            <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <Tooltip formatter={(value: number) => [`₦${value.toLocaleString()}`, "Revenue"]} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--foreground)"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
