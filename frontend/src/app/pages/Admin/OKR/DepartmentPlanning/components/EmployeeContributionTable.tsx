import React from "react";
import {
  MdCheckCircle,
  MdWarning,
  MdOutlineRadioButtonUnchecked,
  MdPeople,
} from "react-icons/md";

type EmployeeContributionData = {
  employeeId: string;
  employeeName: string;
  profilePictureUrl?: string;
  objectiveCount: number;
  krCount: number;
  monthlyPlansCount: number;
  weeklyPlansCount: number;
  dailyPlansCount: number;
  progressUpdateCount: number;
  hasSetMonthlyPlan: boolean;
  hasSetWeeklyPlan: boolean;
  hasSetDailyPlan: boolean;
  hasUpdatedProgress: boolean;
  lastProgressAt?: string | Date | null;
  objectiveStatus?: {
    draft: number;
    submitted: number;
    approved: number;
    published: number;
  };
};

type EmployeeContributionTableProps = {
  employees: EmployeeContributionData[];
  loading?: boolean;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "Never";
  const d = new Date(date);
  const today = new Date();
  const diff = today.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Employee contribution table showing planning & execution metrics:
 * - Employee name & profile
 * - Objectives & KRs count
 * - Planning completion (monthly/weekly/daily)
 * - Progress update history
 */
export default function EmployeeContributionTable({
  employees,
  loading = false,
}: EmployeeContributionTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-slate-100 animate-pulse border border-slate-200"
          />
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
        <MdPeople className="mx-auto text-4xl text-slate-300 mb-3" />
        <h4 className="text-slate-900 font-black text-sm tracking-tight mb-1">
          No employees assigned
        </h4>
        <p className="text-slate-500 text-xs">
          Team members will appear here once they set their objectives.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/50">
          <tr>
            <th className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider">
              Employee
            </th>
            <th className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider">
              Objectives
            </th>
            <th className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider">
              Key Results
            </th>
            <th className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider">
              Planning Status
            </th>
            <th className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider">
              Progress
            </th>
            <th className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider">
              Last Update
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.map((emp) => {
            const planningComplete =
              emp.hasSetMonthlyPlan &&
              emp.hasSetWeeklyPlan &&
              emp.hasSetDailyPlan;
            const progressUpdated = emp.hasUpdatedProgress;

            return (
              <tr
                key={emp.employeeId}
                className="hover:bg-slate-50/50 transition-colors"
              >
                {/* Employee */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {emp.profilePictureUrl ? (
                      <img
                        src={emp.profilePictureUrl}
                        alt={emp.employeeName}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xs font-black border border-primary/20">
                        {getInitials(emp.employeeName)}
                      </div>
                    )}
                    <span className="font-semibold text-slate-900 truncate">
                      {emp.employeeName}
                    </span>
                  </div>
                </td>

                {/* Objectives */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {emp.objectiveCount}
                    </span>
                    {emp.objectiveStatus && (
                      <div className="flex gap-1 text-xs">
                        {emp.objectiveStatus.published > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                            {emp.objectiveStatus.published}P
                          </span>
                        )}
                        {emp.objectiveStatus.submitted > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                            {emp.objectiveStatus.submitted}S
                          </span>
                        )}
                        {emp.objectiveStatus.draft > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                            {emp.objectiveStatus.draft}D
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>

                {/* KRs */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {emp.krCount}
                    </span>
                    {emp.krCount > 0 && emp.monthlyPlansCount > 0 && (
                      <span className="text-xs font-semibold text-slate-500">
                        ({emp.monthlyPlansCount}M)
                      </span>
                    )}
                  </div>
                </td>

                {/* Planning Status */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {emp.hasSetMonthlyPlan ? (
                      <MdCheckCircle className="text-green-600 text-base" />
                    ) : (
                      <MdOutlineRadioButtonUnchecked className="text-slate-300 text-base" />
                    )}
                    <span className="text-xs font-semibold text-slate-600">
                      {emp.hasSetMonthlyPlan && emp.hasSetWeeklyPlan
                        ? "Ready"
                        : emp.hasSetMonthlyPlan
                          ? "Partial"
                          : "Pending"}
                    </span>
                  </div>
                </td>

                {/* Progress */}
                <td className="px-4 py-3">
                  {progressUpdated ? (
                    <div className="flex items-center gap-2">
                      <MdCheckCircle className="text-blue-600 text-base" />
                      <span className="text-xs font-semibold text-slate-600">
                        {emp.progressUpdateCount} updates
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <MdWarning className="text-amber-600 text-base" />
                      <span className="text-xs font-semibold text-slate-600">
                        No updates
                      </span>
                    </div>
                  )}
                </td>

                {/* Last Update */}
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-slate-500">
                    {formatDate(emp.lastProgressAt)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
