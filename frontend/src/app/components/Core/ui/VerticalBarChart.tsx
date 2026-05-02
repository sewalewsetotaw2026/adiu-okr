"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";

interface ChartDataItem {
  name: string;
  value: number;
}

interface VerticalBarChartProps {
  title: string;
  data: ChartDataItem[];
  colors?: string[];
}

export default function VerticalBarChart({
  title,
  data,
  colors,
}: VerticalBarChartProps) {
  return (
    <div className="bg-white mt-10 rounded-2xl shadow-md border border-gray-100 p-7">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">{title}</h2>

      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
            barCategoryGap="6%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#eee"
            />

            <XAxis
              dataKey="name"
              tick={{ fontSize: 13, fill: "#555" }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              tick={{ fontSize: 13, fill: "#666" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />

            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              contentStyle={{
                backgroundColor: "#fff",
                borderRadius: 10,
                border: "1px solid #eee",
                fontSize: "13px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              }}
              labelStyle={{
                fontWeight: 600,
                color: "#333",
              }}
            />

            <Bar
              dataKey="value"
              barSize={68}
              radius={[3, 3, 0, 0]}
              animationDuration={800}
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={colors && colors.length > 0 ? colors[index % colors.length] : "#ffda00"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
