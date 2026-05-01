"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid
} from "recharts";

interface ChartDataItem {
  name: string;
  value: number;
}

interface HorizontalBarChartProps {
  title: string;
  data: ChartDataItem[];
  colors?: string[];
}

export default function HorizontalBarChart({
  title,
  data,
  colors,
}: HorizontalBarChartProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-5">
        {title}
      </h2>

      <div className="h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 20, right: 20, left: 50, bottom: 10 }}
            barGap={25}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 13, fill: "#64748b", fontWeight: 600 }}
              width={140}
            />

            <Tooltip
              cursor={{ fill: "#f1f5f9", radius: 8 }}
              itemStyle={{ fontSize: "14px", fontWeight: 600, color: "#1e293b" }}
              contentStyle={{
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: "10px 14px",
                border: "none",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
              }}
            />

            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={48}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={colors && colors.length > 0 ? colors[index % colors.length] : "#e55400"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
