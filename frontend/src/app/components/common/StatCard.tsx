import React from "react";

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color?: string;
  className?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  color = "bg-k-orange",
  className = "",
  trend,
}: StatCardProps) {
  return (
    <div className={`bg-white p-6 rounded-2xl shadow-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
        >
          <Icon className="text-xl text-white" />
        </div>
        {trend && (
          <div className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${trend.positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
            <span>{trend.positive ? "↑" : "↓"}</span>
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm text-gray-500 font-medium mb-1">{label}</p>
        <h3 className="text-3xl font-bold text-k-dark-grey tracking-tight">{value}</h3>
      </div>
    </div>
  );
}
