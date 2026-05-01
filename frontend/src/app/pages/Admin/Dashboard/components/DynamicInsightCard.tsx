"use client";

import { useState, useMemo } from "react";
import HorizontalBarChart from "../../../../components/Core/ui/HorizontalBarChart";
import VerticalBarChart from "../../../../components/Core/ui/VerticalBarChart";
import DonutChart from "../../../../components/Core/ui/DonutChart";
import FormAutocomplete from "../../../../components/Core/ui/FormAutocomplete";
import { DashboardStats } from "../slice/types";

interface DynamicInsightCardProps {
  stats: DashboardStats;
  departments: { id: number; name: string }[];
}

type InsightType = "Gender Distribution" | "Employment Type" | "Probation Status";

export default function DynamicInsightCard({ stats, departments }: DynamicInsightCardProps) {
  const [insightType, setInsightType] = useState<InsightType>("Gender Distribution");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");
  const [selectedDeptName, setSelectedDeptName] = useState("All Departments");

  // Options for Insight Dropdown
  const insightOptions = ["Gender Distribution", "Employment Type", "Probation Status"];

  // Options for Department Dropdown
  const filterDepartments = async (query: string) => {
    const allOptions = ["All Departments", ...departments.map((d) => d.name)];
    if (!query || query === selectedDeptName) return allOptions;
    return allOptions.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  };

  const handleDeptChange = (val: string) => {
    setSelectedDeptName(val);
    if (val === "All Departments") setSelectedDeptId("all");
    else {
      const d = departments.find(dept => dept.name === val);
      if (d) setSelectedDeptId(String(d.id));
    }
  };

  // --- Data Logic ---
  const chartData = useMemo(() => {
    // 1. Determine Source (Global vs Specific Dept)
    let sourceData: any = {};
    const isGlobal = selectedDeptId === "all";

    if (isGlobal) {
      if (insightType === "Gender Distribution") sourceData = stats?.genderDist;
      else if (insightType === "Employment Type") sourceData = stats?.empTypeDist;
      else if (insightType === "Probation Status") sourceData = stats?.probationStatus;
    } else {
      // Filtered
      const deptStats = stats?.departmentBreakdown?.[selectedDeptId];
      if (deptStats) {
        if (insightType === "Gender Distribution") sourceData = deptStats.gender;
        else if (insightType === "Employment Type") sourceData = deptStats.empTypes;
        else if (insightType === "Probation Status") sourceData = deptStats.probation;
      }
    }

    // 2. Format for Charts
    const labels = Object.keys(sourceData || {});
    const values = Object.values(sourceData || {}) as number[];

    // Return appropriate format for the chart types
    // Vertical/Horizontal Bar expects { name, value }[]
    // Donut expects labels[] and series[]
    if (insightType === "Probation Status") {
      return { labels, series: values };
    }

    return labels.map((l, i) => ({ name: l, value: values[i] }));

  }, [stats, selectedDeptId, insightType]);


  // --- Render Chart ---
  const renderChart = () => {
    // Colors
    const colorsMap = {
      "Gender Distribution": ["#3b82f6", "#ec4899"], // Blue, Pink (Swapped)
      "Employment Type": ["#f59e0b"],
      "Probation Status": ["#f97316", "#facc15"] // In Probation (Orange), Confirmed (Yellow)
    };

    // Check for empty data
    const isEmpty = () => {
      if (insightType === "Probation Status") {
        const d = chartData as { labels: string[], series: number[] };
        return !d.series || d.series.length === 0 || d.series.every(v => v === 0);
      }
      const d = chartData as { name: string, value: number }[];
      return !d || d.length === 0 || d.every(v => v.value === 0);
    };

    if (isEmpty()) {
      return (
        <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
          <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="font-medium text-sm">No data available for this department</p>
        </div>
      );
    }

    if (insightType === "Gender Distribution") {
      return <HorizontalBarChart title="" data={chartData as any} colors={colorsMap[insightType]} />;
    }
    if (insightType === "Employment Type") {
      return <VerticalBarChart title="" data={chartData as any} colors={colorsMap[insightType]} />;
    }
    if (insightType === "Probation Status") {
      const d = chartData as { labels: string[], series: number[] };
      return <DonutChart title="" labels={d.labels} series={d.series} colors={colorsMap[insightType]} />;
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 flex flex-col h-full min-h-[400px]">
      {/* Header Controls */}
      <div className="flex flex-row items-center justify-between mb-4 gap-2">
        <div className="flex-1 max-w-[200px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase mb-0.5 block">Insight</label>
          <div className="relative">
            <select
              className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg p-2 outline-none focus:ring-2 focus:ring-k-orange focus:border-transparent appearance-none font-bold"
              value={insightType}
              onChange={(e) => setInsightType(e.target.value as InsightType)}
            >
              {insightOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            {/* Custom Arrow */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-[200px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase mb-0.5 block">Department</label>
          <FormAutocomplete
            type="departments" // dummy type
            placeholder="All Departments"
            value={selectedDeptName}
            onChange={handleDeptChange}
            fetchSuggestionsFn={filterDepartments}
            containerClassName="!mb-0"
            inputClassName="!bg-gray-50 !border-gray-200 !text-sm !p-2 !rounded-lg !font-bold"
          />
        </div>
      </div>

      {/* Chart Content */}
      <div className="flex-1 border-t border-gray-100 pt-6">
        {renderChart()}
      </div>
    </div>
  );
}
