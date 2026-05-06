import React, { useMemo } from "react";
import {
  MdTrendingUp,
  MdWarning,
  MdCheckCircle,
  MdPeople,
  MdAssignment,
  MdTimeline,
  MdCalendarMonth,
  MdOutlineDateRange,
} from "react-icons/md";

type InsightMetrics = {
  totalObjectives: number;
  totalKRs: number;
  totalEmployees: number;
  averageProgress: number;
  atRiskCount: number;
  onTrackCount: number;
  missingPlansCount: number;
  missingSetsCount: number;
  completedPlansCount: number;
};

type DepartmentInsightsDashboardProps = {
  departmentName: string;
  metrics: InsightMetrics;
  loading?: boolean;
};

/**
 * Department Insights Dashboard showing:
 * - High-level KPIs (objectives, KRs, employees, progress)
 * - Status breakdown (on-track, at-risk)
 * - Planning completion status
 */
export default function DepartmentInsightsDashboard({
  departmentName,
  metrics,
  loading = false,
}: DepartmentInsightsDashboardProps) {
  const progressColor =
    metrics.averageProgress >= 75
      ? "text-green-600"
      : metrics.averageProgress >= 50
        ? "text-blue-600"
        : metrics.averageProgress >= 25
          ? "text-amber-600"
          : "text-red-600";

  const progressBgColor =
    metrics.averageProgress >= 75
      ? "bg-green-50"
      : metrics.averageProgress >= 50
        ? "bg-blue-50"
        : metrics.averageProgress >= 25
          ? "bg-amber-50"
          : "bg-red-50";

  const planningPercent =
    metrics.totalKRs > 0
      ? Math.round(
          ((metrics.completedPlansCount /
            (metrics.totalKRs * 3)) /* 3 levels: monthly, weekly, daily */ *
            100) as unknown as number,
        )
      : 0;

  const planningColor =
    planningPercent >= 75
      ? "text-green-600"
      : planningPercent >= 50
        ? "text-blue-600"
        : "text-amber-600";

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Objectives */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Objectives
              </div>
              <div className="text-3xl font-black text-slate-900">
                {metrics.totalObjectives}
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <MdAssignment className="text-2xl text-blue-600" />
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Set by team members
          </div>
        </div>

        {/* Total KRs */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Key Results
              </div>
              <div className="text-3xl font-black text-slate-900">
                {metrics.totalKRs}
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <MdTimeline className="text-2xl text-purple-600" />
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Active in cycle
          </div>
        </div>

        {/* Team Members */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Team Members
              </div>
              <div className="text-3xl font-black text-slate-900">
                {metrics.totalEmployees}
              </div>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg">
              <MdPeople className="text-2xl text-indigo-600" />
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            In department
          </div>
        </div>

        {/* Average Progress */}
        <div
          className={`rounded-xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow ${progressBgColor}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Average Progress
              </div>
              <div className={`text-3xl font-black ${progressColor}`}>
                {metrics.averageProgress}%
              </div>
            </div>
            <div className="p-3 bg-white/50 rounded-lg">
              <MdTrendingUp className={`text-2xl ${progressColor}`} />
            </div>
          </div>
          <div className="text-xs text-slate-600 font-medium">
            Weighted across Key Results
          </div>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Breakdown */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MdCheckCircle className="text-green-600" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Execution Status
            </h3>
          </div>

          <div className="space-y-3">
            {/* On Track */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
              <div className="flex items-center gap-2">
                <MdCheckCircle className="text-green-600" />
                <span className="font-semibold text-slate-900">On Track</span>
              </div>
              <span className="text-2xl font-black text-green-600">
                {metrics.onTrackCount}
              </span>
            </div>

            {/* At Risk */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
              <div className="flex items-center gap-2">
                <MdWarning className="text-amber-600" />
                <span className="font-semibold text-slate-900">At Risk</span>
              </div>
              <span className="text-2xl font-black text-amber-600">
                {metrics.atRiskCount}
              </span>
            </div>
          </div>
        </div>

        {/* Planning Completion */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MdCalendarMonth className="text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Planning Completion
            </h3>
          </div>

          <div className="space-y-3">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">
                  Plans set (monthly, weekly, daily)
                </span>
                <span className={`text-lg font-black ${planningColor}`}>
                  {planningPercent}%
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    planningPercent >= 75
                      ? "bg-green-500"
                      : planningPercent >= 50
                        ? "bg-blue-500"
                        : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(planningPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="text-center p-2">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Sets completed
                </div>
                <div className="text-xl font-black text-green-600">
                  {metrics.completedPlansCount}
                </div>
              </div>
              <div className="text-center p-2">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Missing
                </div>
                <div className="text-xl font-black text-amber-600">
                  {metrics.missingPlansCount}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {/* <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
        <div className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
          Key Insights
        </div>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex gap-2">
            <span className="text-primary font-black">→</span>
            <span>
              {metrics.missingSetsCount > 0
                ? `${metrics.missingSetsCount} team members haven't completed their planning sets yet`
                : "All team members have completed their planning"}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary font-black">→</span>
            <span>
              {metrics.atRiskCount > 0
                ? `${metrics.atRiskCount} objectives are at risk and may need intervention`
                : "All objectives are on track"}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary font-black">→</span>
            <span>
              Department average progress is {metrics.averageProgress}% across
              all key results
            </span>
          </li>
        </ul>
      </div> */}
    </div>
  );
}
