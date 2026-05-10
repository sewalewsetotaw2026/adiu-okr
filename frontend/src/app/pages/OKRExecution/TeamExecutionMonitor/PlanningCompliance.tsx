import { useCallback, useEffect, useState, useMemo } from "react";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import RefreshButton from "../../../components/common/RefreshButton";
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
  MdRefresh,
  MdSearch,
} from "react-icons/md";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import { okrErrorMessage, okrUnwrap } from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import {
  formatConciseDateRange,
  getCycleWeekRange,
  getPlannedDailyDate,
  parseLocalDate,
  formatDateInput,
} from "../utils/calendarDates";

type MainTabType = "planning" | "reporting" | "progress";
type PeriodType = "Quarterly" | "Monthly" | "Weekly" | "Daily";
type StatusType = "All" | "Planned" | "Not Planned";
type ReportingSortType =
  | "Highest Updates"
  | "Lowest Updates"
  | "Newest Last Update"
  | "Oldest Last Update";
type ProgressStatusType =
  | "All"
  | "Not Started"
  | "Completed"
  | "Blocked"
  | "In Progress";

const DAY_VALUES = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

const DAY_LABELS: Record<(typeof DAY_VALUES)[number], string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const formatMonthDay = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

type CycleDayOption = {
  value: (typeof DAY_VALUES)[number];
  label: string;
};

export default function PlanningCompliancePage() {
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>("planning");
  const [data, setData] = useState<any>({
    objectives: [],
    monthly: [],
    weekly: [],
    daily: [],
    reporting: [],
  });
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<any>(null);

  // Filters
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("Daily");
  const [selectedStatus, setSelectedStatus] = useState<StatusType>("All");
  const [planningSearch, setPlanningSearch] = useState("");

  // Sub-selectors
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedDay, setSelectedDay] = useState<string>("MONDAY");

  // Reporting Filters
  const [reportingDept, setReportingDept] = useState("All");
  const [reportingSource, setReportingSource] = useState("All");
  const [reportingStatus, setReportingStatus] = useState<
    "All" | "reported" | "not_reported"
  >("All");
  const [reportingSort, setReportingSort] =
    useState<ReportingSortType>("Highest Updates");
  const [reportingSearch, setReportingSearch] = useState("");

  // Summary Filters
  const [summaryDept, setSummaryDept] = useState("All");
  const [summarySearch, setSummarySearch] = useState("");
  const [summaryProgressStatus, setSummaryProgressStatus] =
    useState<ProgressStatusType>("All");

  // Pagination
  const [planningPage, setPlanningPage] = useState(1);
  const [reportingPage, setReportingPage] = useState(1);
  const [summaryPage, setSummaryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setPlanningPage(1);
  }, [
    selectedDept,
    selectedPeriod,
    selectedStatus,
    planningSearch,
    selectedMonth,
    selectedWeek,
  ]);

  useEffect(() => {
    setReportingPage(1);
  }, [
    reportingDept,
    reportingSource,
    reportingStatus,
    reportingSort,
    reportingSearch,
  ]);

  useEffect(() => {
    setSummaryPage(1);
  }, [
    summaryDept,
    summarySearch,
    summaryProgressStatus,
    selectedPeriod,
    selectedMonth,
    selectedWeek,
    selectedDay,
  ]);

  const resetFilters = () => {
    setSelectedDept("All");
    setSelectedPeriod("Daily");
    setSelectedStatus("All");
    setPlanningSearch("");
    setSelectedMonth(1);
    setSelectedWeek(1);
    setSelectedDay("MONDAY");
    setPlanningPage(1);
  };

  const resetReportingFilters = () => {
    setReportingDept("All");
    setReportingSource("All");
    setReportingStatus("All");
    setReportingSort("Highest Updates");
    setReportingSearch("");
    setReportingPage(1);
  };

  const resetSummaryFilters = () => {
    setSummaryDept("All");
    setSummarySearch("");
    setSummaryProgressStatus("All");
    setSummaryPage(1);
  };

  const getDailyDayValue = (
    obj: Record<string, number> | undefined,
    dayKey?: string,
  ) => {
    if (!obj || !dayKey) return 0;
    if (dayKey in obj) return obj[dayKey] ?? 0;
    const upper = String(dayKey).toUpperCase();
    if (upper in obj) return obj[upper] ?? 0;
    const lower = String(dayKey).toLowerCase();
    if (lower in obj) return obj[lower] ?? 0;
    const found = Object.keys(obj).find(
      (k) => k.toLowerCase() === String(dayKey).toLowerCase(),
    );
    return found ? (obj[found] ?? 0) : 0;
  };

  const getSummaryScores = useCallback(
    (item: any) => {
      const weeklyObj = item.weekly_progress || item.weeklyProgress || {};
      const monthlyObj = item.monthly_progress || item.monthlyProgress || {};

      let score = 0;
      let indirectScore = 0;
      if (selectedPeriod === "Quarterly") {
        score = item.progress || 0;
        indirectScore = item.indirect_progress || 0;
      } else if (selectedPeriod === "Monthly") {
        score =
          monthlyObj[selectedMonth] ?? monthlyObj[String(selectedMonth)] ?? 0;
        indirectScore =
          item.indirect_monthly_progress?.[selectedMonth] ??
          item.indirect_monthly_progress?.[String(selectedMonth)] ??
          0;
      } else if (selectedPeriod === "Weekly") {
        score = weeklyObj[selectedWeek] ?? weeklyObj[String(selectedWeek)] ?? 0;
        indirectScore =
          item.indirect_weekly_progress?.[selectedWeek] ??
          item.indirect_weekly_progress?.[String(selectedWeek)] ??
          0;
      } else {
        const dailyObj = item.daily_progress || item.dailyProgress || {};
        const weekObj =
          dailyObj[selectedWeek] ?? dailyObj[String(selectedWeek)] ?? {};
        score = getDailyDayValue(weekObj, selectedDay);

        const indirectDaily =
          item.indirect_daily_progress || item.indirectDailyProgress || {};
        const indirectWeekObj =
          indirectDaily[selectedWeek] ??
          indirectDaily[String(selectedWeek)] ??
          {};
        indirectScore = getDailyDayValue(indirectWeekObj, selectedDay);
      }

      return {
        score: Number(Number(score || 0).toFixed(2)),
        indirectScore: Number(Number(indirectScore || 0).toFixed(2)),
      };
    },
    [selectedPeriod, selectedMonth, selectedWeek, selectedDay],
  );

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
      if (selectedPeriod === "Daily") {
        query.week_number = selectedWeek;
        query.completion_day = selectedDay;
      }

      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.managerPlanningCompliance,
        query,
        isSecureRoute: true,
      });
      const report = okrUnwrap(res);
      setData(
        report || {
          objectives: [],
          monthly: [],
          weekly: [],
          daily: [],
          reporting: [],
        },
      );

      // Also get team summary for progress data
      const summaryRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.managerTeamSummary,
        query: {
          cycle_id: cycleData.id,
          month_number:
            selectedPeriod === "Monthly" ? selectedMonth : undefined,
          week_number:
            selectedPeriod === "Weekly" || selectedPeriod === "Daily"
              ? selectedWeek
              : undefined,
          completion_day: selectedPeriod === "Daily" ? selectedDay : undefined,
        },
        isSecureRoute: true,
      });
      const summary = okrUnwrap(summaryRes);
      setSummaryData((summary as any)?.team || []);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedMonth, selectedWeek, selectedDay]);

  useEffect(() => {
    void load();
  }, [load]);

  const cycleStartDate = useMemo(
    () => parseLocalDate(cycle?.start_date),
    [cycle?.start_date],
  );
  const cycleEndDate = useMemo(
    () => parseLocalDate(cycle?.end_date),
    [cycle?.end_date],
  );
  const cycleLabel = useMemo(
    () => formatConciseDateRange(cycle?.start_date, cycle?.end_date),
    [cycle?.start_date, cycle?.end_date],
  );

  useEffect(() => {
    if (!cycleStartDate || !cycleEndDate) return;

    const today = parseLocalDate(formatDateInput(new Date()));
    if (!today) return;

    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor(
      (today.getTime() - cycleStartDate.getTime()) / dayMs,
    );

    if (diffDays < 0 || today > cycleEndDate) {
      setSelectedWeek(1);
      setSelectedDay("MONDAY");
      return;
    }

    setSelectedWeek(Math.max(1, Math.floor(diffDays / 7) + 1));
    setSelectedDay(DAY_VALUES[Math.max(0, diffDays % 7)] ?? "MONDAY");
  }, [cycleStartDate, cycleEndDate]);

  // Extract unique departments from all data sources
  const departments = useMemo(() => {
    const allData = [
      ...data.objectives,
      ...data.monthly,
      ...data.weekly,
      ...data.reporting,
    ];
    const depts = new Set<string>();
    allData.forEach((item: any) => {
      if (item.department_name && item.department_name !== "No Department")
        depts.add(item.department_name);
    });
    return ["All", ...Array.from(depts)].sort();
  }, [data]);

  // Valid weeks for the cycle (relative, 1 to N)
  const validWeeks = useMemo(() => {
    if (!cycleStartDate || !cycleEndDate)
      return Array.from({ length: 12 }, (_, i) => i + 1);

    const diffDays = Math.max(
      1,
      Math.floor(
        (cycleEndDate.getTime() - cycleStartDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1,
    );
    const weeks = Math.ceil(diffDays / 7) || 1;

    return Array.from({ length: weeks }, (_, i) => i + 1);
  }, [cycleStartDate, cycleEndDate]);

  // Valid months for the cycle (relative, 1 to N)
  const validMonths = useMemo(() => {
    if (!cycleStartDate || !cycleEndDate)
      return Array.from({ length: 3 }, (_, i) => i + 1);

    const months: number[] = [];
    const cursor = new Date(cycleStartDate);
    cursor.setDate(1);
    cursor.setHours(12, 0, 0, 0);

    while (cursor <= cycleEndDate) {
      months.push(months.length + 1);
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
      cursor.setHours(12, 0, 0, 0);
    }

    return months.length > 0 ? months : [1];
  }, [cycleStartDate, cycleEndDate]);

  const weekOptions = useMemo(
    () =>
      validWeeks.map((weekNumber) => {
        const weekRange = cycle?.start_date
          ? getCycleWeekRange(cycle.start_date, weekNumber)
          : null;
        const weekEnd =
          weekRange && cycleEndDate && weekRange.end > cycleEndDate
            ? cycleEndDate
            : weekRange?.end;
        return {
          value: weekNumber,
          label:
            weekRange && weekEnd
              ? `Week ${weekNumber} (${formatMonthDay(weekRange.start)} — ${formatMonthDay(weekEnd)})`
              : `Week ${weekNumber}`,
        };
      }),
    [cycle?.start_date, cycleEndDate, validWeeks],
  );

  const dayOptions = useMemo<CycleDayOption[]>(() => {
    if (!cycle?.start_date) {
      return DAY_VALUES.map((day) => ({
        value: day,
        label: DAY_LABELS[day],
      }));
    }

    return DAY_VALUES.map((day) => {
      const plannedDate = getPlannedDailyDate(
        cycle.start_date,
        selectedWeek,
        day,
      );
      if (!plannedDate) return null;
      if (cycleEndDate && plannedDate > cycleEndDate) return null;

      return {
        value: day,
        label: `${plannedDate.toLocaleDateString(undefined, {
          weekday: "long",
        })} (${formatMonthDay(plannedDate)})`,
      };
    }).filter((item): item is CycleDayOption => Boolean(item));
  }, [cycle?.start_date, cycleEndDate, selectedWeek]);

  // Filtered Planning Data
  const filteredPlanningData = useMemo(() => {
    let source = [];
    if (selectedPeriod === "Quarterly") source = data.objectives;
    else if (selectedPeriod === "Monthly") source = data.monthly;
    else if (selectedPeriod === "Weekly") source = data.weekly;
    else source = data.daily;

    return source.filter((item: any) => {
      const deptMatch =
        selectedDept === "All" || item.department_name === selectedDept;

      let isPlanned = false;
      if (selectedPeriod === "Quarterly") isPlanned = item.is_planned === true;
      else if (selectedPeriod === "Monthly")
        isPlanned = item.has_month_plan === true;
      else if (selectedPeriod === "Weekly")
        isPlanned = item.weekly_plans?.length > 0;
      else if (selectedPeriod === "Daily")
        isPlanned = item.has_daily_plan === true;

      const nameMatch = String(item.employee_name || "")
        .toLowerCase()
        .includes(planningSearch.trim().toLowerCase());

      const statusMatch =
        selectedStatus === "All" ||
        (selectedStatus === "Planned" && isPlanned) ||
        (selectedStatus === "Not Planned" && !isPlanned);

      return deptMatch && statusMatch && nameMatch;
    });
  }, [data, selectedDept, selectedPeriod, selectedStatus, planningSearch]);

  // Filtered Reporting Data
  const filteredReportingData = useMemo(() => {
    if (!data.reporting) return [];
    let result = [...data.reporting];

    // Filter by Department
    if (reportingDept !== "All") {
      result = result.filter(
        (item: any) => item.department_name === reportingDept,
      );
    }

    const reportingSearchNormalized = reportingSearch.trim().toLowerCase();
    if (reportingSearchNormalized) {
      result = result.filter((item: any) =>
        String(item.employee_name || "")
          .toLowerCase()
          .includes(reportingSearchNormalized),
      );
    }

    // Filter by Source
    if (reportingSource !== "All") {
      result = result.filter((item: any) => {
        if (reportingSource === "Quarterly") return true;
        if (reportingSource === "Weekly") return item.breakdown?.weekly > 0;
        if (reportingSource === "Daily")
          return (
            item.breakdown?.daily > 0 ||
            item.breakdown?.daily_plan_with_progress > 0
          );
        if (reportingSource === "Monthly") return item.breakdown?.monthly > 0;
        if (reportingSource === "Key Result") return item.breakdown?.direct > 0;
        if (reportingSource === "Rollup") return item.breakdown?.indirect > 0;
        return true;
      });
    }

    // Filter by Status (Reported / Not Reported) based on progress score
    if (reportingStatus !== "All") {
      result = result.filter((item: any) => {
        const summaryItem = summaryData.find(
          (s) => s.employee_id === item.employee_id,
        );
        if (!summaryItem) return reportingStatus === "not_reported";

        const score = getSummaryScores(summaryItem).score;

        return reportingStatus === "reported" ? score > 0 : score === 0;
      });
    }

    // Sort
    result.sort((a: any, b: any) => {
      if (reportingSort === "Highest Updates")
        return (b.update_count || 0) - (a.update_count || 0);
      if (reportingSort === "Lowest Updates")
        return (a.update_count || 0) - (b.update_count || 0);
      if (reportingSort === "Newest Last Update") {
        const dateA = a.last_update ? new Date(a.last_update).getTime() : 0;
        const dateB = b.last_update ? new Date(b.last_update).getTime() : 0;
        return dateB - dateA;
      }
      if (reportingSort === "Oldest Last Update") {
        const dateA = a.last_update
          ? new Date(a.last_update).getTime()
          : Infinity;
        const dateB = b.last_update
          ? new Date(b.last_update).getTime()
          : Infinity;
        return dateA - dateB;
      }
      return 0;
    });

    return result;
  }, [
    data.reporting,
    summaryData,
    reportingDept,
    reportingSource,
    reportingStatus,
    reportingSort,
    selectedPeriod,
    selectedMonth,
    selectedWeek,
    selectedDay,
    reportingSearch,
    getSummaryScores,
  ]);

  // Filtered Summary Data
  const filteredSummaryData = useMemo(() => {
    let result = [...summaryData];
    if (summaryDept !== "All") {
      result = result.filter(
        (item: any) => item.department_name === summaryDept,
      );
    }

    const summarySearchNormalized = summarySearch.trim().toLowerCase();
    if (summarySearchNormalized) {
      result = result.filter((item: any) =>
        String(item.employee_name || "")
          .toLowerCase()
          .includes(summarySearchNormalized),
      );
    }

    if (summaryProgressStatus !== "All") {
      result = result.filter((item: any) => {
        const { score } = getSummaryScores(item);
        if (summaryProgressStatus === "Not Started") return score <= 0;
        if (summaryProgressStatus === "In Progress")
          return score > 0 && score < 100;
        if (summaryProgressStatus === "Completed") return score >= 100;
        if (summaryProgressStatus === "Blocked")
          return Boolean(item.is_blocked);
        return true;
      });
    }

    return result;
  }, [
    summaryData,
    summaryDept,
    summarySearch,
    summaryProgressStatus,
    getSummaryScores,
  ]);

  // Paginated Data
  const paginatedPlanningData = useMemo(() => {
    const startIndex = (planningPage - 1) * ITEMS_PER_PAGE;
    return filteredPlanningData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPlanningData, planningPage]);
  const totalPlanningPages = Math.ceil(
    filteredPlanningData.length / ITEMS_PER_PAGE,
  );

  const paginatedReportingData = useMemo(() => {
    const startIndex = (reportingPage - 1) * ITEMS_PER_PAGE;
    return filteredReportingData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredReportingData, reportingPage]);
  const totalReportingPages = Math.ceil(
    filteredReportingData.length / ITEMS_PER_PAGE,
  );

  const paginatedSummaryData = useMemo(() => {
    const startIndex = (summaryPage - 1) * ITEMS_PER_PAGE;
    return filteredSummaryData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSummaryData, summaryPage]);
  const totalSummaryPages = Math.ceil(
    filteredSummaryData.length / ITEMS_PER_PAGE,
  );

  const renderPlanningTab = () => (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-45">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Employee
          </label>
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={planningSearch}
              onChange={(e) => setPlanningSearch(e.target.value)}
              placeholder="Search employee name"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 min-w-45">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Department
          </label>
          <div className="relative">
            <MdBusiness className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-37.5">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Planning Cadence
          </label>
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
              <option value="Daily">Daily</option>
            </select>
          </div>
        </div>

        {selectedPeriod === "Monthly" && (
          <div className="flex-1 min-w-30 animate-in fade-in slide-in-from-left-2">
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">
              Select Month
            </label>
            <div className="relative">
              <MdCalendarMonth className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                {validMonths.map((m) => (
                  <option key={m} value={m}>
                    Month {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {(selectedPeriod === "Weekly" || selectedPeriod === "Daily") && (
          <div className="flex-1 min-w-30 animate-in fade-in slide-in-from-left-2">
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">
              Select Week
            </label>
            <div className="relative">
              <MdViewWeek className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                {weekOptions.map((week) => (
                  <option key={week.value} value={week.value}>
                    {week.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedPeriod === "Daily" && (
          <div className="flex-1 min-w-30 animate-in fade-in slide-in-from-left-2">
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">
              Select Day
            </label>
            <div className="relative">
              <MdAccessTime className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                {dayOptions.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-37.5">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Status
          </label>
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
                <th className="px-6 py-4 font-semibold text-gray-600">
                  Employee Name
                </th>
                <th className="px-6 py-4 font-semibold text-gray-600">
                  Department
                </th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-center">
                  Planning Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    Loading data...
                  </td>
                </tr>
              ) : filteredPlanningData.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No employees found matching filters.
                  </td>
                </tr>
              ) : (
                paginatedPlanningData.map((item: any, idx: number) => {
                  let isPlanned = false;
                  if (selectedPeriod === "Quarterly")
                    isPlanned = item.is_planned === true;
                  else if (selectedPeriod === "Monthly")
                    isPlanned = item.has_month_plan === true;
                  else if (selectedPeriod === "Weekly")
                    isPlanned = item.weekly_plans?.length > 0;
                  else if (selectedPeriod === "Daily")
                    isPlanned = item.has_daily_plan === true;

                  return (
                    <tr
                      key={`${item.employee_id}-${idx}`}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {item.employee_name}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {item.department_name}
                      </td>
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
              Showing {(planningPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(
                planningPage * ITEMS_PER_PAGE,
                filteredPlanningData.length,
              )}{" "}
              of {filteredPlanningData.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPlanningPage((p) => Math.max(1, p - 1))}
                disabled={planningPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2">
                Page {planningPage} of {totalPlanningPages || 1}
              </span>
              <button
                onClick={() =>
                  setPlanningPage((p) => Math.min(totalPlanningPages, p + 1))
                }
                disabled={
                  planningPage === totalPlanningPages ||
                  totalPlanningPages === 0
                }
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
      {/* Reporting Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-45">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Employee
          </label>
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={reportingSearch}
              onChange={(e) => setReportingSearch(e.target.value)}
              placeholder="Search employee name"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 min-w-45">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Department
          </label>
          <div className="relative">
            <MdBusiness className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={reportingDept}
              onChange={(e) => setReportingDept(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex-1 min-w-37.5">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Reporting Cadence
          </label>
          <div className="relative">
            <MdFilterList className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={reportingSource}
              onChange={(e) => setReportingSource(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              {/* <option value="All">All Sources</option> */}
              <option value="Quarterly">Quarterly</option>
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
              <option value="Daily">Daily</option>
              {/* <option value="Key Result">Key Result</option>
              <option value="Rollup">Rollup</option> */}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-45">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Status
          </label>
          <div className="relative">
            <MdFilterList className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={reportingStatus}
              onChange={(e) => setReportingStatus(e.target.value as any)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="not_reported">Not Reported</option>
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
                <th className="px-6 py-4 font-semibold text-gray-600">
                  Employee Name
                </th>
                <th className="px-6 py-4 font-semibold text-gray-600">
                  Department
                </th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-center">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    Loading data...
                  </td>
                </tr>
              ) : filteredReportingData.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No reporting data available.
                  </td>
                </tr>
              ) : (
                paginatedReportingData.map((item: any) => {
                  const summaryItem = summaryData.find(
                    (s) => s.employee_id === item.employee_id,
                  );
                  const displayScore = summaryItem
                    ? getSummaryScores(summaryItem).score
                    : 0;
                  const isReported = displayScore > 0;

                  return (
                    <tr
                      key={item.employee_id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {item.employee_name}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {item.department_name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isReported ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <MdCheckCircle className="text-xs" /> Reported
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                            <MdCancel className="text-xs" /> Not Reported
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
        {filteredReportingData.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <span className="text-sm text-gray-500">
              Showing {(reportingPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(
                reportingPage * ITEMS_PER_PAGE,
                filteredReportingData.length,
              )}{" "}
              of {filteredReportingData.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReportingPage((p) => Math.max(1, p - 1))}
                disabled={reportingPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2">
                Page {reportingPage} of {totalReportingPages || 1}
              </span>
              <button
                onClick={() =>
                  setReportingPage((p) => Math.min(totalReportingPages, p + 1))
                }
                disabled={
                  reportingPage === totalReportingPages ||
                  totalReportingPages === 0
                }
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
        <div className="flex-1 min-w-45">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Employee
          </label>
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={summarySearch}
              onChange={(e) => setSummarySearch(e.target.value)}
              placeholder="Search employee name"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 min-w-45">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Department
          </label>
          <div className="relative">
            <MdBusiness className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={summaryDept}
              onChange={(e) => setSummaryDept(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-37.5">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Reporting Cadence
          </label>
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
              <option value="Daily">Daily</option>
            </select>
          </div>
        </div>

        {selectedPeriod === "Monthly" && (
          <div className="flex-1 min-w-30 animate-in fade-in slide-in-from-left-2">
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">
              Select Month
            </label>
            <div className="relative">
              <MdCalendarMonth className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                {validMonths.map((m) => (
                  <option key={m} value={m}>
                    Month {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {(selectedPeriod === "Weekly" || selectedPeriod === "Daily") && (
          <div className="flex-1 min-w-30 animate-in fade-in slide-in-from-left-2">
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">
              Select Week
            </label>
            <div className="relative">
              <MdViewWeek className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                {weekOptions.map((week) => (
                  <option key={week.value} value={week.value}>
                    {week.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedPeriod === "Daily" && (
          <div className="flex-1 min-w-30 animate-in fade-in slide-in-from-left-2">
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">
              Select Day
            </label>
            <div className="relative">
              <MdAccessTime className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                {dayOptions.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-37.5">
          <label className="text-xs font-bold text-gray-400 mb-1.5 block">
            Status
          </label>
          <div className="relative">
            <MdFilterList className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={summaryProgressStatus}
              onChange={(e) =>
                setSummaryProgressStatus(e.target.value as ProgressStatusType)
              }
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>
        </div>

        <button
          onClick={resetSummaryFilters}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-all text-sm self-end mb-0.5"
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
                <th className="px-6 py-4 font-semibold text-gray-600">
                  Employee Name
                </th>
                <th className="px-6 py-4 font-semibold text-gray-600">
                  Department
                </th>
                <th className="px-6 py-4 font-semibold text-gray-600">
                  Job Title
                </th>
                <th className="px-6 py-4 font-semibold text-gray-600">Score</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    Loading data...
                  </td>
                </tr>
              ) : filteredSummaryData.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No progress data available.
                  </td>
                </tr>
              ) : (
                paginatedSummaryData.map((item: any, idx: number) => {
                  const {
                    score: displayScore,
                    indirectScore: displayIndirect,
                  } = getSummaryScores(item);

                  return (
                    <tr
                      key={`${item.employee_id}-${idx}`}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {item.employee_name}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {item.department_name}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {item.job_title}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 max-w-35">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-300"
                                style={{ width: `${displayScore}%` }}
                              />
                            </div>
                            <span className="text-[10px] tabular-nums text-gray-700 font-bold">
                              {displayScore}%
                            </span>
                          </div>
                          {displayIndirect > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                                  style={{ width: `${displayIndirect}%` }}
                                />
                              </div>
                              <span className="text-[10px] tabular-nums text-indigo-600 font-bold">
                                {displayIndirect}%
                              </span>
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
        {filteredSummaryData.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <span className="text-sm text-gray-500">
              Showing {(summaryPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(
                summaryPage * ITEMS_PER_PAGE,
                filteredSummaryData.length,
              )}{" "}
              of {filteredSummaryData.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
                disabled={summaryPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2">
                Page {summaryPage} of {totalSummaryPages || 1}
              </span>
              <button
                onClick={() =>
                  setSummaryPage((p) => Math.min(totalSummaryPages, p + 1))
                }
                disabled={
                  summaryPage === totalSummaryPages || totalSummaryPages === 0
                }
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
          actions={<RefreshButton onClick={load} loading={loading} />}
        >
          {cycleLabel !== "—" && (
            <div className="mb-5 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-tight shadow-sm w-fit">
              <span className="opacity-70">Cycle:</span>
              <span className="text-slate-700 normal-case tracking-normal">
                {cycleLabel}
              </span>
            </div>
          )}
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
            <button
              onClick={() => setActiveMainTab("progress")}
              className={`flex-1 py-4 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 border-2 ${
                activeMainTab === "progress"
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
