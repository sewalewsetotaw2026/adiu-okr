"use client";

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartDataItem {
  name: string;
  value: number;
}

interface AreaChartProps {
  title: string;
  data: ChartDataItem[];
  colors?: string[];
}

export default function AreaChart({
  title,
  data,
  colors = ["#0EA5E9"],
}: AreaChartProps) {
  const gradientId = `colorGradient-${Math.random().toString(36).substr(2, 9)}`;
  const mainColor = colors[0];

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 h-full">
      <h2 className="text-lg font-bold text-k-dark-grey mb-4">{title}</h2>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsAreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={mainColor} stopOpacity={0.8} />
                <stop offset="95%" stopColor={mainColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#9ca3af" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              cursor={{ stroke: mainColor, strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={mainColor}
              strokeWidth={4}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              animationDuration={2000}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </RechartsAreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
