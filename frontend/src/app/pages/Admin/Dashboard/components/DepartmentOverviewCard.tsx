import React from "react";
import HorizontalBarChart from "../../../../components/Core/ui/HorizontalBarChart";

interface DepartmentOverviewCardProps {
  data: { name: string; value: number }[];
}

export default function DepartmentOverviewCard({ data }: DepartmentOverviewCardProps) {
  // Sort and take top 5 for the summary card
  const topDepts = [...data].sort((a, b) => b.value - a.value).slice(0, 5);

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 h-full min-h-[400px]">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-k-dark-grey">Department Overview</h2>
        <p className="text-xs text-gray-500 font-medium">Top 5 Largest Departments</p>
      </div>
      <div className="flex-1 mt-4">
        <HorizontalBarChart title="" data={topDepts} />
      </div>
    </div>
  );
}
