"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

interface TrendChartProps {
  title: string;
  data: { name: string; value: number }[];
  colors?: string[];
}

export default function TrendChart({
  title,
  data,
  colors = ["#0EA5E9"],
}: TrendChartProps) {
  const mainColor = colors[0];

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-k-dark-grey">{title}</h2>
      </div>

      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            barSize={32}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#9ca3af", fontWeight: 500 }}
              dy={15}
              height={50}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              dx={-10}
            />
            <Tooltip
              cursor={{ fill: '#f9fafb', radius: 4 }}
              contentStyle={{
                backgroundColor: "#fff",
                borderRadius: "12px",
                border: "none",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                padding: "12px 16px"
              }}
              labelStyle={{ color: "#6b7280", marginBottom: "4px", fontSize: "12px" }}
              itemStyle={{ color: "#111827", fontWeight: "bold", fontSize: "14px" }}
            />
            <Bar
              dataKey="value"
              radius={[6, 6, 0, 0]}
              animationDuration={1500}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={mainColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
