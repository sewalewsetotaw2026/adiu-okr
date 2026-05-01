import React, { useMemo } from "react";
import HorizontalBarChart from "../../../../components/Core/ui/HorizontalBarChart";

interface JobLevelOverviewCardProps {
  data: Record<string, number>;
}

export default function JobLevelOverviewCard({ data }: JobLevelOverviewCardProps) {
  // Process and sort data
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Descending order
  }, [data]);

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 h-full min-h-[400px]">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-k-dark-grey">Workforce Seniority</h2>
        <p className="text-xs text-gray-500 font-medium">Distribution by Job Level</p>
      </div>
      <div className="flex-1 mt-4">
        {/* Using a custom turquoise palette for seniority */}
        <HorizontalBarChart
          title=""
          data={chartData}
          colors={["#14b8a6", "#0d9488", "#0f766e"]}
        />
      </div>
    </div>
  );
}
