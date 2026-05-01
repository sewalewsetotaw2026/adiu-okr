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

type MainTabType = "planning" | "reporting";
type PeriodType = "Quarterly" | "Monthly" | "Weekly";
type StatusType = "All" | "Planned" | "Not Planned";

export default function PlanningCompliancePage() {
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>("planning");
  const [data, setData] = useState<any>({ objectives: [], monthly: [], weekly: [], daily: [], reporting: [] });
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<any>(null);

  // Filters
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("Quarterly");
  const [selectedStatus, setSelectedStatus] = useState<StatusType>("All");
  
  // Sub-selectors
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  const resetFilters = () => {
    setSelectedDept("All");
    setSelectedPeriod("Quarterly");
    setSelectedStatus("All");
    setSelectedMonth(new Date().getMonth() + 1);
    setSelectedWeek(1);
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

  // Valid weeks for the cycle
  const validWeeks = useMemo(() => {
    if (!cycle?.start_date || !cycle?.end_date) return Array.from({ length: 52 }, (_, i) => i + 1);
    
    const start = new Date(cycle.start_date);
    const end = new Date(cycle.end_date);
    
    const getWeek = (date: Date) => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    const startWeek = getWeek(start);
    const endWeek = getWeek(end);
    
    const weeks = [];
    if (startWeek <= endWeek) {
      for (let i = startWeek; i <= endWeek; i++) weeks.push(i);
    } else {
      // Handles year wrap if necessary, but cycles are usually within a year or quarterly
      for (let i = startWeek; i <= 52; i++) weeks.push(i);
      for (let i = 1; i <= endWeek; i++) weeks.push(i);
    }
    return weeks;
  }, [cycle]);

  // Valid months for the cycle
  const validMonths = useMemo(() => {
    if (!cycle?.start_date || !cycle?.end_date) return Array.from({ length: 12 }, (_, i) => i + 1);
    const start = new Date(cycle.start_date).getMonth() + 1;
    const end = new Date(cycle.end_date).getMonth() + 1;
    const months = [];
    if (start <= end) {
      for (let i = start; i <= end; i++) months.push(i);
    } else {
      for (let i = start; i <= 12; i++) months.push(i);
      for (let i = 1; i <= end; i++) months.push(i);
    }
    return months;
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
                filteredPlanningData.map((item: any, idx: number) => {
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
              ) : data.reporting.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No reporting data available.</td></tr>
              ) : (
                data.reporting.map((item: any) => (
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
                          <span className={`px-2 py-1 rounded text-[10px] font-bold border ${
                            item.breakdown.daily_plan_with_progress === item.breakdown.daily_plan_total
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
                            Direct: {item.breakdown.direct}
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
              className={`flex-1 py-4 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 border-2 ${
                activeMainTab === "planning"
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-white text-gray-500 border-gray-100 hover:border-primary/30 hover:bg-primary/5"
              }`}
            >
              <MdOutlinePlaylistAddCheck className="text-2xl" />
              Planning
            </button>
            <button
              onClick={() => setActiveMainTab("reporting")}
              className={`flex-1 py-4 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 border-2 ${
                activeMainTab === "reporting"
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-white text-gray-500 border-gray-100 hover:border-primary/30 hover:bg-primary/5"
              }`}
            >
              <MdBarChart className="text-2xl" />
              Reporting
            </button>
          </div>

          {/* Tab Content */}
          {activeMainTab === "planning" ? renderPlanningTab() : renderReportingTab()}
        </ExecutionShell>
      </div>
    </EmployeeLayout>
  );
}
