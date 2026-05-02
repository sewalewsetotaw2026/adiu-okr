"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Sector,
} from "recharts";
import { PieSectorDataItem } from "recharts/types/polar/Pie";

interface ManagerialPieProps {
  managerial: number;
  nonManagerial: number;
  title?: string;
}

export default function ManagerialPie({
  managerial,
  nonManagerial,
  title = "Managerial vs Non-Managerial",
}: ManagerialPieProps) {
  const data = [
    { name: "Managerial", value: managerial },
    { name: "Non-Managerial", value: nonManagerial },
  ];

  const [activeIndex, setActiveIndex] = useState(0);

  const total = managerial + nonManagerial;
  const percentage = Math.round((managerial / total) * 100);

  return (
    <div className="bg-white mt-10 rounded-2xl align-ce shadow-md border border-gray-100 p-5 w-[340px]">
      {/* Title */}
      <h2 className="text-sm font-semibold text-gray-800 mb-4">{title}</h2>

      <div className="relative w-full aspect-square">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: "#fff",
                borderRadius: 10,
                border: "1px solid #eee",
                fontSize: "12px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
              }}
            />

            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={90}
              strokeWidth={5}
              activeIndex={activeIndex}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              activeShape={({
                outerRadius = 0,
                ...props
              }: PieSectorDataItem) => (
                <g>
                  <Sector {...props} outerRadius={outerRadius + 8} />
                  <Sector
                    {...props}
                    outerRadius={outerRadius + 18}
                    innerRadius={outerRadius + 10}
                  />
                </g>
              )}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={index === 0 ? "#FFCC00" : "#E5E7EB"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">{managerial}</span>
          <span className="text-xs text-gray-500">Managers</span>
          <span className="text-[10px] mt-1 text-gray-400">
            {percentage}% of total
          </span>
        </div>
      </div>

      {/* Legends */}
      <div className="flex justify-center gap-4 mt-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-[#FFCC00] rounded-full" />
          Managerial
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-gray-200 rounded-full" />
          Non-Managerial
        </div>
      </div>
    </div>
  );
}
