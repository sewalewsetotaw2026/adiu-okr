import { useCallback, useEffect, useState, useMemo } from "react";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import { routeConstants } from "../../../../utils/constants";
import {
  MdOutlinePlaylistAddCheck,
  MdCheckCircle,
  MdCancel,
  MdBusiness,
  MdAccessTime,
  MdFilterList,
  MdBarChart,
  MdTimeline,
  MdCalendarMonth,
  MdViewWeek,
  MdRefresh
} from "react-icons/md";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import { okrErrorMessage, okrUnwrap } from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";

type MainTabType = "planning" | "reporting" | "progress";
type PeriodType = "Quarterly" | "Monthly" | "Weekly";
type StatusType = "All" | "Planned" | "Not Planned";
type ReportingSortType = "Highest Updates" | "Lowest Updates" | "Newest Last Update" | "Oldest Last Update";

export default function PlanningCompliancePage() {
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>("planning");
  const [data, setData] = useState<any>({ objectives: [], monthly: [], weekly: [], daily: [], reporting: [] });
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<any>(null);

  // Filters
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("Quarterly");
  const [selectedStatus, setSelectedStatus] = useState<StatusType>("All");

  // Sub-selectors
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Reporting Filters
  const [reportingDept, setReportingDept] = useState("All");
  const [reportingSource, setReportingSource] = useState("All");
  const [reportingSort, setReportingSort] = useState<ReportingSortType>("Highest Updates");

  // Pagination
  const [planningPage, setPlanningPage] = useState(1);
  const [reportingPage, setReportingPage] = useState(1);
  const [summaryPage, setSummaryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setPlanningPage(1);
  }, [selectedDept, selectedPeriod, selectedStatus, selectedMonth, selectedWeek]);

  useEffect(() => {
    setReportingPage(1);
  }, [reportingDept, reportingSource, reportingSort]);

  useEffect(() => {
    setSummaryPage(1);
  }, [selectedPeriod, selectedMonth, selectedWeek]);

  const resetFilters = () => {
    setSelectedDept("All");
    setSelectedPeriod("Quarterly");
    setSelectedStatus("All");
    setSelectedMonth(1);
    setSelectedWeek(1);
    setPlanningPage(1);
  };

  const resetReportingFilters = () => {
    setReportingDept("All");
    setReportingSource("All");
    setReportingSort("Highest Updates");
    setReportingPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Get current cycle
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycleData = okrUnwrap(cycleRes) as any;
      setCycle(cycleData);

      if (!cycleData?.id) {
        setLoading(false);
        return;
      }

      // Get compliance report
      const query: any = { cycle_id: cycleData.id };
      if (selectedPeriod === "Monthly") query.month_number = selectedMonth;
      if (selectedPeriod === "Weekly") query.week_number = selectedWeek;

      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.managerPlanningCompliance,
        query,
        isSecureRoute: true,
      });
      const report = okrUnwrap(res);
      setData(report || { objectives: [], monthly: [], weekly: [], daily: [], reporting: [] });

      // Also get team summary for progress data
      const summaryRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.managerTeamSummary,
        query: { cycle_id: cycleData.id },
        isSecureRoute: true,
      });
      const summary = okrUnwrap(summaryRes);
      setSummaryData((summary as any)?.team || []);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedMonth, selectedWeek]);

  useEffect(() => {
    void load();
  }, [load]);

  // Extract unique departments from all data sources
  const departments = useMemo(() => {
    const allData = [
      ...data.objectives,
      ...data.monthly,
      ...data.weekly,
      ...data.reporting
    ];
    const depts = new Set<string>();
    allData.forEach((item: any) => {
      if (item.department_name && item.department_name !== "No Department") depts.add(item.department_name);
    });
    return ["All", ...Array.from(depts)].sort();
  }, [data]);

  // Valid weeks for the cycle (relative, 1 to N)
  const validWeeks = useMemo(() => {
    if (!cycle?.start_date || !cycle?.end_date) return Array.from({ length: 12 }, (_, i) => i + 1);

    const start = new Date(cycle.start_date);
    const end = new Date(cycle.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.ceil(diffDays / 7) || 1;

    return Array.from({ length: weeks }, (_, i) => i + 1);
  }, [cycle]);

  // Valid months for the cycle (relative, 1 to N)
  const validMonths = useMemo(() => {
    if (!cycle?.start_date || !cycle?.end_date) return Array.from({ length: 3 }, (_, i) => i + 1);

    const start = new Date(cycle.start_date);
    const end = new Date(cycle.end_date);
    let months = (end.getFullYear() - start.getFullYear()) * 12;
    months -= start.getMonth();
    months += end.getMonth();
    const totalMonths = (months <= 0 ? 0 : months) + 1;

    return Array.from({ length: totalMonths }, (_, i) => i + 1);
  }, [cycle]);

  // Filtered Planning Data
  const filteredPlanningData = useMemo(() => {
    let source = [];
    if (selectedPeriod === "Quarterly") source = data.objectives;
    else if (selectedPeriod === "Monthly") source = data.monthly;
    else source = data.weekly;

    return source.filter((item: any) => {
      const deptMatch = selectedDept === "All" || item.department_name === selectedDept;

      let isPlanned = false;
      if (selectedPeriod === "Quarterly") isPlanned = item.is_planned === true;
      else if (selectedPeriod === "Monthly") isPlanned = item.has_month_plan === true;
      else if (selectedPeriod === "Weekly") isPlanned = item.weekly_plans?.length > 0;

      const statusMatch =
        selectedStatus === "All" ||
        (selectedStatus === "Planned" && isPlanned) ||
        (selectedStatus === "Not Planned" && !isPlanned);

      return deptMatch && statusMatch;
    });
  }, [data, selectedDept, selectedPeriod, selectedStatus]);

  // Filtered Reporting Data
  const filteredReportingData = useMemo(() => {
    if (!data.reporting) return [];
    let result = [...data.reporting];

    // Filter by Department
    if (reportingDept !== "All") {
      result = result.filter((item: any) => item.department_name === reportingDept);
    }

    // Filter by Source
    if (reportingSource !== "All") {
      result = result.filter((item: any) => {
        if (reportingSource === "Weekly") return item.breakdown?.weekly > 0;
        if (reportingSource === "Daily") return item.breakdown?.daily > 0 || item.breakdown?.daily_plan_with_progress > 0;
        if (reportingSource === "Monthly") return item.breakdown?.monthly > 0;
        if (reportingSource === "Key Result") return item.breakdown?.direct > 0;
        if (reportingSource === "Rollup") return item.breakdown?.indirect > 0;
        return true;
      });
    }

    // Sort
    result.sort((a: any, b: any) => {
      if (reportingSort === "Highest Updates") return (b.update_count || 0) - (a.update_count || 0);
      if (reportingSort === "Lowest Updates") return (a.update_count || 0) - (b.update_count || 0);
      if (reportingSort === "Newest Last Update") {
        const dateA = a.last_update ? new Date(a.last_update).getTime() : 0;
        const dateB = b.last_update ? new Date(b.last_update).getTime() : 0;
        return dateB - dateA;
      }
      if (reportingSort === "Oldest Last Update") {
        const dateA = a.last_update ? new Date(a.last_update).getTime() : Infinity;
        const dateB = b.last_update ? new Date(b.last_update).getTime() : Infinity;
        return dateA - dateB;
      }
      return 0;
    });

    return result;
  }, [data.reporting, reportingDept, reportingSource, reportingSort]);

  // Paginated Data
  const paginatedPlanningData = useMemo(() => {
    const startIndex = (planningPage - 1) * ITEMS_PER_PAGE;
    return filteredPlanningData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPlanningData, planningPage]);
  const totalPlanningPages = Math.ceil(filteredPlanningData.length / ITEMS_PER_PAGE);

  const paginatedReportingData = useMemo(() => {
    const startIndex = (reportingPage - 1) * ITEMS_PER_PAGE;
    return filteredReportingData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredReportingData, reportingPage]);
  const totalReportingPages = Math.ceil(filteredReportingData.length / ITEMS_PER_PAGE);

  const renderPlanningTab = () => (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">Department</label>
          <div className="relative">
            <MdBusiness className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">Period Type</label>
          <div className="relative">
            <MdAccessTime className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as PeriodType)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="Quarterly">Quarterly</option>
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
            </select>
          </div>
        </div>

        {selectedPeriod === "Monthly" && (
          <div className="flex-1 min-w-[120px] animate-in fade-in slide-in-from-left-2">
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">Select Month</label>
            <div className="relative">
              <MdCalendarMonth className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                {validMonths.map(m => (
                  <option key={m} value={m}>Month {m}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedPeriod === "Weekly" && (
          <div className="flex-1 min-w-[120px] animate-in fade-in slide-in-from-left-2">
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">Select Week</label>
            <div className="relative">
              <MdViewWeek className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                {validWeeks.map(w => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">Status</label>
          <div className="relative">
            <MdFilterList className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as StatusType)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Planned">Planned</option>
              <option value="Not Planned">Not Planned</option>
            </select>
          </div>
        </div>

        <button
          onClick={resetFilters}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-all text-sm self-end mb-0.5"
        >
          <MdRefresh className="text-lg" />
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 ring-1 ring-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-6 py-4 font-semibold text-gray-600">Employee Name</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Department</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-center">Planning Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400">Loading data...</td></tr>
              ) : filteredPlanningData.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400">No employees found matching filters.</td></tr>
              ) : (
                paginatedPlanningData.map((item: any, idx: number) => {
                  let isPlanned = false;
                  if (selectedPeriod === "Quarterly") isPlanned = item.is_planned === true;
                  else if (selectedPeriod === "Monthly") isPlanned = item.has_month_plan === true;
                  else if (selectedPeriod === "Weekly") isPlanned = item.weekly_plans?.length > 0;

                  return (
                    <tr key={`${item.employee_id}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.employee_name}</td>
                      <td className="px-6 py-4 text-gray-500">{item.department_name}</td>
                      <td className="px-6 py-4 text-center">
                        {isPlanned ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <MdCheckCircle className="text-sm" /> Planned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                            <MdCancel className="text-sm" /> Not Planned
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredPlanningData.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <span className="text-sm text-gray-500">
              Showing {(planningPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(planningPage * ITEMS_PER_PAGE, filteredPlanningData.length)} of {filteredPlanningData.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPlanningPage(p => Math.max(1, p - 1))}
                disabled={planningPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2">
                Page {planningPage} of {totalPlanningPages || 1}
              </span>
              <button
                onClick={() => setPlanningPage(p => Math.min(totalPlanningPages, p + 1))}
                disabled={planningPage === totalPlanningPages || totalPlanningPages === 0}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderReportingTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 ring-1 ring-gray-100 text-center">
        <MdBarChart className="text-6xl text-primary/20 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">Reporting Compliance</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Track how often your team is updating their progress towards their OKRs.
        </p>
      </div>

      {/* Reporting Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">Department</label>
          <div className="relative">
            <MdBusiness className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={reportingDept}
              onChange={(e) => setReportingDept(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">Update Source</label>
          <div className="relative">
            <MdFilterList className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={reportingSource}
              onChange={(e) => setReportingSource(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="All">All Sources</option>
              <option value="Weekly">Weekly</option>
              <option value="Daily">Daily</option>
              <option value="Monthly">Monthly</option>
              <option value="Key Result">Key Result</option>
              <option value="Rollup">Rollup</option>
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">Sort By</label>
          <div className="relative">
            <MdFilterList className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={reportingSort}
              onChange={(e) => setReportingSort(e.target.value as ReportingSortType)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="Highest Updates">Highest Updates</option>
              <option value="Lowest Updates">Lowest Updates</option>
              <option value="Newest Last Update">Newest Last Update</option>
              <option value="Oldest Last Update">Oldest Last Update</option>
            </select>
          </div>
        </div>

        <button
          onClick={resetReportingFilters}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-all text-sm self-end mb-0.5 cursor-pointer"
        >
          <MdRefresh className="text-lg" />
          Reset
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 ring-1 ring-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-6 py-4 font-semibold text-gray-600">Employee Name</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Department</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Update Sources</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-center">Total Updates</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-center">Last Update</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Loading data...</td></tr>
              ) : filteredReportingData.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No reporting data available.</td></tr>
              ) : (
                paginatedReportingData.map((item: any) => (
                  <tr key={item.employee_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.employee_name}</td>
                    <td className="px-6 py-4 text-gray-500">{item.department_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {item.breakdown?.weekly > 0 && (
                          <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold border border-indigo-100">
                            Weekly: {item.breakdown.weekly}
                          </span>
                        )}
                        {item.breakdown?.daily_plan_total > 0 && (
                          <span className={`px-2 py-1 rounded text-[10px] font-bold border ${item.breakdown.daily_plan_with_progress === item.breakdown.daily_plan_total
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-amber-50 text-amber-600 border-amber-100"
                            }`}>
                            Daily: {item.breakdown.daily_plan_with_progress}/{item.breakdown.daily_plan_total} Planned
                          </span>
                        )}
                        {item.breakdown?.monthly > 0 && (
                          <span className="px-2 py-1 rounded bg-teal-50 text-teal-600 text-[10px] font-bold border border-teal-100">
                            Monthly: {item.breakdown.monthly}
                          </span>
                        )}
                        {item.breakdown?.direct > 0 && (
                          <span className="px-2 py-1 rounded bg-slate-50 text-slate-600 text-[10px] font-bold border border-slate-100">
                            Key Result: {item.breakdown.direct}
                          </span>
                        )}
                        {item.breakdown?.indirect > 0 && (
                          <span className="px-2 py-1 rounded bg-purple-50 text-purple-600 text-[10px] font-bold border border-purple-100">
                            Rollup: {item.breakdown.indirect}
                          </span>
                        )}
                        {(!item.breakdown || Object.values(item.breakdown).every(v => v === 0)) && (
                          <span className="text-gray-300 italic text-xs">No updates yet</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-primary">
                      {item.update_count} Updates
                    </td>
                    <td className="px-6 py-4 text-center text-gray-400">
                      {item.last_update ? new Date(item.last_update).toLocaleDateString() : "Never"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredReportingData.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <span className="text-sm text-gray-500">
              Showing {(reportingPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(reportingPage * ITEMS_PER_PAGE, filteredReportingData.length)} of {filteredReportingData.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReportingPage(p => Math.max(1, p - 1))}
                disabled={reportingPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2">
                Page {reportingPage} of {totalReportingPages || 1}
              </span>
              <button
                onClick={() => setReportingPage(p => Math.min(totalReportingPages, p + 1))}
                disabled={reportingPage === totalReportingPages || totalReportingPages === 0}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderProgressTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">Period Type</label>
          <div className="relative">
            <MdAccessTime className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="Quarterly">Quarterly</option>
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
            </select>
          </div>
        </div>

        {selectedPeriod === "Monthly" && (
          <div className="flex-1 min-w-[120px] animate-in fade-in slide-in-from-left-2">
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">Select Month</label>
            <div className="relative">
              <MdCalendarMonth className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                {validMonths.map(m => (
                  <option key={m} value={m}>Month {m}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedPeriod === "Weekly" && (
          <div className="flex-1 min-w-[120px] animate-in fade-in slide-in-from-left-2">
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">Select Week</label>
            <div className="relative">
              <MdViewWeek className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                {validWeeks.map(w => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 ring-1 ring-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-6 py-4 font-semibold text-gray-600">Employee Name</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Department</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Job Title</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Score</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">Loading data...</td></tr>
              ) : summaryData.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">No progress data available.</td></tr>
              ) : (
                summaryData.slice((summaryPage - 1) * ITEMS_PER_PAGE, summaryPage * ITEMS_PER_PAGE).map((item: any, idx: number) => {
                  const weeklyObj = item.weekly_progress || item.weeklyProgress || {};
                  const monthlyObj = item.monthly_progress || item.monthlyProgress || {};

                  let score = 0;
                  let indirectScore = 0;
                  if (selectedPeriod === "Quarterly") {
                    score = item.progress || 0;
                    indirectScore = item.indirect_progress || 0;
                  } else if (selectedPeriod === "Monthly") {
                    score = monthlyObj[selectedMonth] ?? monthlyObj[String(selectedMonth)] ?? 0;
                    indirectScore = item.indirect_monthly_progress?.[selectedMonth] ?? item.indirect_monthly_progress?.[String(selectedMonth)] ?? 0;
                  } else if (selectedPeriod === "Weekly") {
                    score = weeklyObj[selectedWeek] ?? weeklyObj[String(selectedWeek)] ?? 0;
                    indirectScore = item.indirect_weekly_progress?.[selectedWeek] ?? item.indirect_weekly_progress?.[String(selectedWeek)] ?? 0;
                  }

                  const displayScore = Number(Number(score).toFixed(2));
                  const displayIndirect = Number(Number(indirectScore).toFixed(2));

                  return (
                    <tr key={`${item.employee_id}-${idx}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.employee_name}</td>
                      <td className="px-6 py-4 text-gray-500">{item.department_name}</td>
                      <td className="px-6 py-4 text-gray-500">{item.job_title}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 max-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${displayScore}%` }} />
                            </div>
                            <span className="text-[10px] tabular-nums text-gray-700 font-bold">{displayScore}%</span>
                          </div>
                          {displayIndirect > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${displayIndirect}%` }} />
                              </div>
                              <span className="text-[10px] tabular-nums text-indigo-600 font-bold">{displayIndirect}%</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );

                })
              )}
            </tbody>
          </table>
        </div>
        {summaryData.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <span className="text-sm text-gray-500">
              Showing {(summaryPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(summaryPage * ITEMS_PER_PAGE, summaryData.length)} of {summaryData.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSummaryPage(p => Math.max(1, p - 1))}
                disabled={summaryPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2">
                Page {summaryPage} of {Math.ceil(summaryData.length / ITEMS_PER_PAGE) || 1}
              </span>
              <button
                onClick={() => setSummaryPage(p => Math.min(Math.ceil(summaryData.length / ITEMS_PER_PAGE), p + 1))}
                disabled={summaryPage === Math.ceil(summaryData.length / ITEMS_PER_PAGE) || Math.ceil(summaryData.length / ITEMS_PER_PAGE) === 0}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-slate-50/50 -mx-4 md:-mx-8 px-4 md:px-8 py-6">
        <ExecutionShell
          breadcrumbs={[
            { label: "My Team", to: routeConstants.managerMyTeam },
            { label: "Compliance" },
          ]}
          title="Compliance Tracking"
          subtitle="Monitor planning and reporting compliance across your team."
          icon={<MdTimeline className="text-3xl text-primary" />}
        >
          {/* Main Tabs Navigation */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setActiveMainTab("planning")}
              className={`flex-1 py-4 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 border-2 ${activeMainTab === "planning"
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary/30 hover:bg-primary/5"
                }`}
            >
              <MdOutlinePlaylistAddCheck className="text-2xl" />
              Planning
            </button>
            <button
              onClick={() => setActiveMainTab("reporting")}
              className={`flex-1 py-4 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 border-2 ${activeMainTab === "reporting"
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary/30 hover:bg-primary/5"
                }`}
            >
              <MdBarChart className="text-2xl" />
              Reporting
            </button>
            <button
              onClick={() => setActiveMainTab("progress")}
              className={`flex-1 py-4 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 border-2 ${activeMainTab === "progress"
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary/30 hover:bg-primary/5"
                }`}
            >
              <MdTimeline className="text-2xl" />
              Progress Summary
            </button>
          </div>

          {/* Tab Content */}
          {activeMainTab === "planning" && renderPlanningTab()}
          {activeMainTab === "reporting" && renderReportingTab()}
          {activeMainTab === "progress" && renderProgressTab()}
        </ExecutionShell>
      </div>
    </EmployeeLayout>
  );
}
