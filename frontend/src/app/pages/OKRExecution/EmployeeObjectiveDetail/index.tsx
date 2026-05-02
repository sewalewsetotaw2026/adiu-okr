import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import BulletText from "../../../components/common/BulletText";
import BulletTextarea from "../../../components/common/BulletTextarea";
import { routeConstants } from "../../../../utils/constants";
import {
  MdViewList,
  MdCalendarMonth,
  MdDateRange,
  MdChecklist,
  MdHistory,
  MdAdd,
  MdAssignmentReturned,
  MdArrowBack,
  MdTrendingUp,
  MdSend,
  MdPublish,
  MdWarningAmber,
  MdChevronRight,
} from "react-icons/md";
import EmployeeKRModal, {
  type MetricPick,
} from "../components/modals/EmployeeKRModal";
import MonthlyPlanModal from "../components/modals/MonthlyPlanModal";
import WeeklyPlanModal from "../components/modals/WeeklyPlanModal";
import ProgressUpdateModal from "../components/modals/ProgressUpdateModal";
import DailyPlanProgressModal from "../components/modals/DailyPlanProgressModal";
import DailyPlanModal from "../components/modals/DailyPlanModal";
import Button from "../../../components/Core/ui/Button";
import OkrStatusBadge, {
  type OkrStatusTone,
} from "../components/OkrStatusBadge";

import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import {
  fromBackendExecutionMode,
  okrAsArray,
  okrErrorMessage,
  okrUnwrap,
} from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import { useDispatch, useSelector } from "react-redux";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import { useManagerSlice } from "../../../slice/managerSlice";
import { selectTeamMembers } from "../../../slice/managerSlice/selectors";
import AssignContributorModal from "../components/modals/AssignContributorModal";

type TabId =
  | "overview"
  | "krs"
  | "monthly"
  | "weekly"
  | "daily_plans"
  | "updates";

const TABS_CONFIG: { id: TabId; label: string; icon: typeof MdViewList }[] = [
  { id: "overview", label: "Overview", icon: MdViewList },
  { id: "krs", label: "My Key Results", icon: MdViewList },
  { id: "monthly", label: "Monthly Plans", icon: MdCalendarMonth },
  { id: "weekly", label: "Weekly Plans", icon: MdDateRange },
  { id: "daily_plans", label: "Daily Plans", icon: MdChecklist },
  { id: "updates", label: "Updates History", icon: MdHistory },
];

type KrRow = {
  id: number;
  title: string;
  description?: string;
  execution_mode?: string;
  status_code?: string;
  progress_percent?: string | number | null;
  final_value?: string | number | null;
  current_value?: string | number | null;
  metric_definition_id?: number;
  metricDefinition?: any;
  target_value?: string | number | null;
  unit_of_measure?: string | null;
  weight_percent?: string | number | null;
  normalized_weight?: string | number | null;
  approvalLogs?: Array<{ action: string; comments: string | null }>;
  contributors?: any[];
  is_direct?: boolean | null;
};

const SUBTASK_STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

function resolveStatusTone(status: string): OkrStatusTone {
  const s = String(status ?? "").toLowerCase();
  if (s === "approved" || s === "published" || s === "completed")
    return "success";
  if (s === "pending_approval" || s === "submitted" || s === "in_progress")
    return "warning";
  if (s === "rejected" || s === "changes_requested") return "error";
  if (s === "draft" || s === "") return "muted";
  return "neutral";
}

function formatStatusLabel(status: string): string {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  if (!s || s === "draft") return "Draft";
  if (s === "pending_approval" || s === "submitted") return "Pending Approval";
  if (s === "approved" || s === "published") return "Approved";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Simple progress bar for plan rows. */
function ProgressBar({
  percent,
  className = "",
  color = "bg-primary",
}: {
  percent: number;
  className?: string;
  color?: string;
}) {
  const p = Math.min(100, Math.max(0, percent || 0));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${p}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-gray-500">
        {Number((percent || 0).toFixed(2))}%
      </span>
    </div>
  );
}

export default function EmployeeObjectiveDetailPage() {
  const { objectiveId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");

  const [loading, setLoading] = useState(true);
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [objectiveStatus, setObjectiveStatus] = useState("");
  const [objectiveFinalScore, setObjectiveFinalScore] = useState<string>("—");
  const [objectiveFinalValue, setObjectiveFinalValue] = useState<string>("—");
  const [objectiveIndirectScore, setObjectiveIndirectScore] = useState<string>("—");
  const [objectiveIndirectValue, setObjectiveIndirectValue] = useState<string>("—");
  const [objectiveIndirectTarget, setObjectiveIndirectTarget] = useState<number>(0);
  const [objectiveCurrentValue, setObjectiveCurrentValue] = useState<number>(0);
  const [objectiveTargetValue, setObjectiveTargetValue] = useState<number>(0);
  const [objective, setObjective] = useState<any>(null);
  const [cycleLabel, setCycleLabel] = useState("");

  const [mItems, setMItems] = useState<any[]>([]);
  const [parentKrTitle, setParentKrTitle] = useState("");
  const [parentKrDescription, setParentKrDescription] = useState("");
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [parentDeptKr, setParentDeptKr] = useState<Record<
    string,
    unknown
  > | null>(null);

  const [metricDefinitions, setMetricDefinitions] = useState<MetricPick[]>([]);
  const [krs, setKrs] = useState<KrRow[]>([]);
  const [selectedKrId, setSelectedKrId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [monthPlans, setMonthPlans] = useState<any[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [progressHistory, setProgressHistory] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [alignmentMonthOptions, setAlignmentMonthOptions] = useState<any[]>([]);
  const [alignmentWeeklyOptions, setAlignmentWeeklyOptions] = useState<any[]>(
    [],
  );
  const [managerWeeklyPlans, setManagerWeeklyPlans] = useState<any[]>([]);
  const [mAlignment, setMAlignment] = useState<any>(null);
  const [selectedMonthPlanIds, setSelectedMonthPlanIds] = useState<Set<number>>(
    new Set(),
  );
  const [selectedWeeklyPlanIds, setSelectedWeeklyPlanIds] = useState<
    Set<number>
  >(new Set());
  const [selectedDailyPlanIds, setSelectedDailyPlanIds] = useState<Set<number>>(
    new Set(),
  );

  const [krModal, setKrModal] = useState(false);
  const [krEditId, setKrEditId] = useState<number | null>(null);
  const [krTitle, setKrTitle] = useState("");
  const [krDesc, setKrDesc] = useState("");
  const [krMetricId, setKrMetricId] = useState<number | "">("");
  const [krTarget, setKrTarget] = useState<number | "">("");
  const [krUnit, setKrUnit] = useState("");
  const [krWeight, setKrWeight] = useState(50);
  const [krAssignedEmployeeIds, setKrAssignedEmployeeIds] = useState<string[]>(
    [],
  );
  const [krLockedEmployeeIds, setKrLockedEmployeeIds] = useState<string[]>([]);
  const [krIsDirect, setKrIsDirect] = useState(true);

  const [monthModal, setMonthModal] = useState(false);
  const [mSelectedKrId, setMSelectedKrId] = useState<number | "">("");
  const [mMonthNum, setMMonthNum] = useState(1);
  const [mDesc, setMDesc] = useState("");
  const [mTargetValue, setMTargetValue] = useState<number | "">("");
  const [mCurrentValue, setMCurrentValue] = useState<number | "">("");
  const [mContributeScore, setMContributeScore] = useState(true);
  const [mContributeValue, setMContributeValue] = useState(true);
  const [mMetricId, setMMetricId] = useState<number | "">("");
  const [mWeightPercent, setMWeightPercent] = useState<number | "">("");
  const [mEditId, setMEditId] = useState<number | null>(null);

  const [weekModal, setWeekModal] = useState(false);
  const [wWeekNum, setWWeekNum] = useState(1);
  const [wMonthPlanId, setWMonthPlanId] = useState<number | "">("");
  const [wTitle, setWTitle] = useState("");
  const [wDesc, setWDesc] = useState("");
  const [wItems, setWItems] = useState<any[]>([]);
  const [wEditId, setWEditId] = useState<number | null>(null);

  const [dailyPlanModal, setDailyPlanModal] = useState(false);
  const [dpMonthPlanId, setDpMonthPlanId] = useState<number | null>(null);
  const [dpWeekNumber, setDpWeekNumber] = useState<number | null>(null);
  const [dpSelectedWeeklyPlanIds, setDpSelectedWeeklyPlanIds] = useState<
    number[]
  >([]);
  const [dpSelectedTaskIds, setDpSelectedTaskIds] = useState<number[]>([]);
  const [dpKrTargets, setDpKrTargets] = useState<
    Record<
      number,
      { target: number | ""; initial: number | ""; metricId: number | ""; isDirect: boolean }
    >
  >({});
  const [dpTitle, setDpTitle] = useState("");
  const [dpDesc, setDpDesc] = useState("");
  const [dpWeeklyTaskRef, setDpWeeklyTaskRef] = useState("");
  const [dpCompletionDay, setDpCompletionDay] = useState("MONDAY");
  const [dpEditId, setDpEditId] = useState<number | null>(null);

  const [subOpen, setSubOpen] = useState(false);
  const [subTitle, setSubTitle] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subMonth, setSubMonth] = useState(1);
  const [subWeek, setSubWeek] = useState(1);

  const [progModal, setProgModal] = useState(false);
  const [progValue, setProgValue] = useState(0);
  const [progIsCompleted, setProgIsCompleted] = useState(false);
  const [note, setNote] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [progMonth, setProgMonth] = useState(1);
  const [progWeek, setProgWeek] = useState(1);
  const [progDailyPlanId, setProgDailyPlanId] = useState<number | null>(null);
  const [dailyProgModal, setDailyProgModal] = useState(false);
  const [dailyProgContext, setDailyProgContext] = useState({
    taskTitle: "",
    dailyTitle: "",
    day: "",
  });
  const [progTarget, setProgTarget] = useState(0);

  const [publishBusy, setPublishBusy] = useState(false);
  const [modeUpdatingKrId, setModeUpdatingKrId] = useState<number | null>(null);
  const [planningCadence, setPlanningCadence] = useState<
    "MONTHLY" | "WEEKLY" | "DAILY"
  >("DAILY");
  const [cadenceRules, setCadenceRules] = useState<any>(null);
  const [levelRules, setLevelRules] = useState<any>(null);
  const [maxKrs, setMaxKrs] = useState<number | null>(null);

  // Manager Assignment State
  const dispatch = useDispatch();
  const { actions: managerActions } = useManagerSlice();
  const authUser = useSelector(selectAuthUser) as any;
  const teamMembers = useSelector(selectTeamMembers);
  const [assignModal, setAssignModal] = useState(false);
  const [assignTargetKrId, setAssignTargetKrId] = useState<number | null>(null);
  const [assignTargetTitle, setAssignTargetTitle] = useState("");
  const [assignTargetIsEmployee, setAssignTargetIsEmployee] = useState(false);
  const [selectedSubordinateId, setSelectedSubordinateId] = useState("");
  const [isRequiredContributor, setIsRequiredContributor] = useState(true);
  const [assignLoading, setAssignLoading] = useState(false);

  const wKrOptions = useMemo(() => {
    if (!wMonthPlanId) return [];
    const plan = monthPlans.find((p) => p.id === wMonthPlanId);
    if (!plan) return [];
    return (plan.items || []).map((i: any) => ({
      id: i.id,
      employeeKrId: i.employee_kr_id || i.employeeKr?.id,
      title: i.title || i.employeeKr?.title || "Key Result",
      targetValue: Number(i.target_value || 0),
      metricId: i.metric_definition_id,
    }));
  }, [wMonthPlanId, monthPlans]);

  const dpKrOptions = useMemo(() => {
    if (!dpMonthPlanId || !dpWeekNumber) return [];
    const plansForWeek = weeklyPlans.filter(
      (w: any) =>
        w.employee_month_plan_id === dpMonthPlanId &&
        w.week_number === dpWeekNumber,
    );
    return plansForWeek.map((w: any) => ({
      id: w.id,
      title: w.employeeKr?.title || "Key Result",
      targetValue: Number(w.target_value || 0),
      metricId: w.metric_definition_id,
    }));
  }, [dpMonthPlanId, dpWeekNumber, weeklyPlans]);

  const dpExistingDays = useMemo(() => {
    if (dpSelectedWeeklyPlanIds.length === 0) return [];
    const wpId = dpSelectedWeeklyPlanIds[0];
    const wp = weeklyPlans.find((w: any) => w.id === wpId);
    if (!wp || !wp.tasks) return [];

    const daysSet = new Set<string>();
    wp.tasks.forEach((t: any) => {
      t.dailyPlans?.forEach((dp: any) => {
        if (dp.completion_day) daysSet.add(dp.completion_day);
      });
    });
    return Array.from(daysSet);
  }, [dpSelectedWeeklyPlanIds, weeklyPlans]);

  const isManager = useMemo(() => {
    const role = String(authUser?.role?.name || authUser?.role || "")
      .toUpperCase()
      .trim();
    const managerialRoles = [
      "ADMIN",
      "MANAGER",
      "DEPARTMENT_HEAD",
      "DIRECTOR",
      "CEO",
      "HOD",
      "TEAM_LEAD",
      "SUPER_ADMIN",
      "V_P",
      "EXECUTIVE",
      "PRESIDENT",
    ];
    return (
      managerialRoles.includes(role) || (teamMembers && teamMembers.length > 0)
    );
  }, [authUser, teamMembers]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await makeCall({
          method: "GET",
          route: apiRoutes.okr.companyMetrics,
          isSecureRoute: true,
        });
        const data = res?.data?.data ?? res?.data ?? [];
        const list = Array.isArray(data)
          ? data
          : ((data as any)?.metrics ?? []);
        const rows = Array.isArray(list) ? list : [];
        const normalized: MetricPick[] = rows
          .map((m: any) => ({
            id: Number(m.id),
            name:
              String(
                m.name ?? m.title ?? m.metric_name ?? m.code ?? "",
              ).trim() || `Metric #${m.id}`,
            unit_of_measure:
              typeof m.unit_of_measure === "string"
                ? m.unit_of_measure
                : undefined,
          }))
          .filter((m) => Number.isFinite(m.id));
        if (!cancelled) setMetricDefinitions(normalized);
      } catch {
        if (!cancelled) setMetricDefinitions([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authUser) {
      dispatch(managerActions.getMyTeam());
    }
  }, [dispatch, managerActions, authUser]);

  const applyParentDefaults = useCallback(() => {
    const p = parentDeptKr as any;
    const md = p?.metricDefinition;
    const mid = md?.id ?? p?.metric_definition_id;
    if (mid != null && Number.isFinite(Number(mid))) {
      setKrMetricId(Number(mid));
    } else {
      setKrMetricId("");
    }
    const tv = p?.target_value;
    setKrTarget(tv != null && String(tv).trim() !== "" ? Number(tv) : "");
    const u =
      (typeof p?.unit_of_measure === "string" && p.unit_of_measure) ||
      (typeof md?.unit_of_measure === "string" && md.unit_of_measure) ||
      "";
    setKrUnit(u || "%");
  }, [parentDeptKr]);

  const loadCore = useCallback(async () => {
    if (!objectiveId) return;
    setLoading(true);
    try {
      const detRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.employeeObjectiveById(objectiveId),
        isSecureRoute: true,
      });
      const d = okrUnwrap(detRes) as any;
      setObjective(d);
      setObjectiveTitle(d?.title ?? `Objective ${objectiveId}`);
      setObjectiveStatus(String(d?.status_code ?? d?.status ?? ""));
      setObjectiveFinalScore(
        d?.progress_percent != null ? String(d.progress_percent) : "—",
      );
      setObjectiveFinalValue(
        d?.current_value != null
          ? String(d.current_value)
          : d?.final_value != null
            ? String(d.final_value)
            : "—",
      );
      setObjectiveCurrentValue(
        Number(d?.current_value ?? d?.currentValue ?? d?.final_value ?? d?.finalValue ?? 0)
      );
      setObjectiveTargetValue(Number(d?.target_value ?? d?.targetValue ?? 0));
      const cy = d?.cycle;
      setCycleLabel(
        cy?.quarter_label ??
        cy?.name ??
        (cy?.id != null ? `Cycle ${cy.id}` : ""),
      );
      const pkr =
        d?.parentDepartmentKr ??
        d?.parent_department_kr ??
        d?.parentEmployeeKr ??
        d?.parent_employee_kr;
      setParentDeptKr(pkr && typeof pkr === "object" ? pkr : null);
      setParentKrTitle(
        typeof pkr?.title === "string" ? pkr.title : "Parent KR",
      );
      setParentKrDescription(
        typeof pkr?.description === "string" ? pkr.description : "",
      );
      setActivityLog(okrAsArray(d?.activityLog ?? d?.activity_log));

      // Aggregate Plans from Objective Detail
      const mPlans = okrAsArray(d?.monthPlans ?? []);
      setMonthPlans(mPlans);

      const wPlans = mPlans.flatMap((m: any) => m.weeklyPlans || []);
      setWeeklyPlans(wPlans);

      // Use keyResults from Objective Detail
      const list = okrAsArray<any>(d?.keyResults ?? []);

      // Aggregate Subtasks and Progress History from KRs
      const allSubtasks = list.flatMap((k) => k.subtasks || []);
      setSubtasks(allSubtasks);

      const allProgress = list.flatMap((k) => k.progressUpdates || []);
      setProgressHistory(allProgress);

      const mapped: KrRow[] = list.map((k) => ({
        id: Number(k.id),
        title: k.title ?? "KR",
        description: k.description,
        execution_mode: k.execution_mode,
        status_code: k.status_code,
        current_value: k.current_value ?? k.currentValue,
        progress_percent: k.progress_percent ?? k.progressPercent,
        final_value: k.final_value ?? k.finalValue,
        is_direct: k.is_direct ?? k.isDirect,
        metric_definition_id:
          k.metric_definition_id != null
            ? Number(k.metric_definition_id)
            : k.metricDefinition?.id,
        target_value: k.target_value ?? k.targetValue,
        unit_of_measure: k.unit_of_measure ?? k.unitOfMeasure,
        weight_percent: k.weight_percent ?? k.weightPercent,
        approvalLogs: k.approvalLogs,
        metricDefinition: k.metricDefinition,
        contributors: k.contributors,
      }));
      setKrs(mapped);
      // We still keep selectedKrId for forms/modals but it won't filter the lists anymore.
      setSelectedKrId((prev) => {
        if (prev && mapped.some((k) => k.id === prev)) return prev;
        return mapped[0]?.id ?? null;
      });

      // Fetch planning cadence
      try {
        const [cadenceRes, levelRes, menuRes] = await Promise.all([
          makeCall({
            method: "GET",
            route: apiRoutes.okr.configurationByKey("planning_cadence"),
            isSecureRoute: true,
          }),
          makeCall({
            method: "GET",
            route: apiRoutes.okr.configurationByKey("level_configuration"),
            isSecureRoute: true,
          }),
          makeCall({
            method: "GET",
            route: apiRoutes.okr.configurationMenu,
            isSecureRoute: true,
          }),
        ]);

        const cadenceConfig = okrUnwrap(cadenceRes) as any;
        const activeCadence =
          cadenceConfig?.config_value_json?.active_cadence ||
          cadenceConfig?.config_value_json ||
          "MONTHLY";
        setPlanningCadence(String(activeCadence).toUpperCase() as any);
        setCadenceRules(cadenceConfig?.config_value_json?.rules || null);

        const levelConfig = okrUnwrap(levelRes) as any;
        setLevelRules(levelConfig?.config_value_json || null);

        const menuConfig = okrUnwrap(menuRes) as any;
        const mk = menuConfig?.additional_configuration?.allowed_krs?.max;
        if (mk) setMaxKrs(Number(mk));
      } catch (e) {
        console.warn("Failed to fetch planning cadence configuration", e);
        setPlanningCadence("MONTHLY");
      }
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [objectiveId]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  const loadKrScoped = useCallback(async () => {
    await loadCore();
  }, [loadCore]);

  const selectedKr = useMemo(
    () => krs.find((k) => k.id === (selectedKrId || mSelectedKrId)),
    [krs, selectedKrId, mSelectedKrId],
  );

  const isExecutionEnabled = useMemo(() => {
    if (!selectedKr) return false;
    const s = String(selectedKr.status_code ?? "").toLowerCase();
    return ["approved", "published"].includes(s);
  }, [selectedKr]);

  // Sync Progress Modal value based on selected cycle (Month/Week/Day)
  useEffect(() => {
    if (!progModal || !selectedKrId) return;

    if (progDailyPlanId) {
      // Find specific Daily Plan across all weeks of this KR (usually we check current progWeek)
      const wPlan = weeklyPlans.find(
        (w) => w.employee_kr_id === selectedKrId && w.week_number === progWeek,
      );
      if (wPlan) {
        const dPlan = (wPlan.dailyPlans || wPlan.daily_plans || []).find(
          (d: any) => d.id === progDailyPlanId,
        );
        if (dPlan) {
          setProgValue(Number(dPlan.current_value ?? 0));
          setProgTarget(Number(dPlan.target_value ?? 0));
          return;
        }
      }
      setProgValue(0);
      setProgTarget(0);
    } else if (progWeek) {
      // Find matching Weekly Plan
      const wPlan = weeklyPlans.find(
        (w) => w.employee_kr_id === selectedKrId && w.week_number === progWeek,
      );
      if (wPlan) {
        setProgValue(Number(wPlan.current_value ?? wPlan.final_value ?? 0));
        setProgTarget(Number(wPlan.target_value ?? 0));
        return;
      }
      setProgValue(0);
      setProgTarget(0);
    } else if (progMonth) {
      // Find matching Month Plan Item
      const mPlan = monthPlans.find((m) => m.month_number === progMonth);
      const mItem = (mPlan?.items || []).find(
        (i: any) => i.employee_kr_id === selectedKrId,
      );
      if (mItem) {
        setProgValue(Number(mItem.current_value ?? 0));
        setProgTarget(Number(mItem.target_value ?? 0));
        return;
      }
      setProgValue(0);
      setProgTarget(0);
    }
  }, [
    progModal,
    progMonth,
    progWeek,
    progDailyPlanId,
    selectedKrId,
    weeklyPlans,
    monthPlans,
  ]);

  const allowedCadence = useMemo(() => {
    const role = String(
      authUser?.role?.name || authUser?.role || "",
    ).toUpperCase();
    let effectiveRole: any = "EMPLOYEE";
    if (role.includes("CEO")) effectiveRole = "CEO";
    else if (role.includes("DIRECTOR")) effectiveRole = "DIRECTOR";
    else if (
      role.includes("MANAGER") ||
      role.includes("LEAD") ||
      role.includes("HOD") ||
      role.includes("VP")
    )
      effectiveRole = "MANAGER_TEAM_LEADER";

    const rules = levelRules?.[effectiveRole] || {
      allow_monthly: true,
      allow_weekly: false,
      allow_daily: false,
    };

    // Global cadence overrides
    const globalRules = cadenceRules?.[planningCadence] || {
      allow_monthly: true,
      allow_weekly: planningCadence !== "MONTHLY",
      allow_daily: planningCadence === "DAILY",
    };

    return {
      monthly: rules.allow_monthly && globalRules.allow_monthly,
      weekly: rules.allow_weekly && globalRules.allow_weekly,
      daily: rules.allow_daily && globalRules.allow_daily,
      subtasks: planningCadence !== "DAILY", // No sub-day planning if daily is allowed
    };
  }, [levelRules, authUser, planningCadence, cadenceRules]);

  const TABS = useMemo(() => {
    return [...TABS_CONFIG];
  }, []);

  useEffect(() => {
    if (
      tab === "monthly" ||
      tab === "weekly" ||
      tab === "daily_plans" ||
      tab === "updates"
    ) {
      void loadKrScoped();
    }
  }, [tab, loadKrScoped]);

  useEffect(() => {
    if (
      monthModal &&
      objective?.chosen_parent_employee_kr_id &&
      objective?.cycle_id
    ) {
      void makeCall({
        method: "GET",
        route:
          apiRoutes.okr.managerPlans.alignmentMonth(mMonthNum) +
          `?cycle_id=${objective.cycle_id}&user_id=${objective.user_id}`,
        isSecureRoute: true,
      })
        .then((res) => {
          const options: any[] = [];
          if (res.data?.data) {
            res.data.data.forEach((plan: any) => {
              plan.items?.forEach((item: any) => {
                options.push({
                  id: item.id,
                  title: `[M${plan.month_number}] ${item.title}`,
                  targetValue: item.target_value,
                  krTitle: item.employeeKr?.title,
                });
              });
            });
          }
          setAlignmentMonthOptions(options);
        })
        .catch(console.error);
    }
  }, [mMonthNum, monthModal, objective]);

  useEffect(() => {
    if (
      weekModal &&
      objective?.chosen_parent_employee_kr_id &&
      objective?.cycle_id
    ) {
      void makeCall({
        method: "GET",
        route:
          apiRoutes.okr.managerPlans.alignmentWeekly(wWeekNum) +
          `?cycle_id=${objective.cycle_id}&user_id=${objective.user_id}`,
        isSecureRoute: true,
      })
        .then((res) => {
          const options: any[] = [];

          if (res.data?.data) {
            res.data.data.forEach((plan: any) => {
              if (plan.tasks && plan.tasks.length > 0) {
                plan.tasks.forEach((task: any) => {
                  options.push({
                    id: task.id, // 👈 now task-level id
                    title: `[W${plan.week_number}] ${task.title}`,
                    targetValue: task.target_value,
                    krTitle: plan.employeeKr?.title,
                    weeklyPlanId: plan.id,
                  });
                });
              } else {
                // fallback if no tasks
                options.push({
                  id: plan.id,
                  title: `[W${plan.week_number}] ${plan.title || "Untitled Plan"}`,
                  targetValue: plan.target_value,
                  krTitle: plan.employeeKr?.title,
                });
              }
            });
          }

          setAlignmentWeeklyOptions(options);
          // const options: any[] = [];
          // if (res.data?.data) {
          //   res.data.data.forEach((plan: any) => {
          //     const taskTitles = plan.tasks && plan.tasks.length > 0
          //       ? plan.tasks.map((t: any) => t.title).join(", ")
          //       : "Untitled Plan";
          //     options.push({
          //       id: plan.id,
          //       title: `[W${plan.week_number}] ${plan.title || taskTitles}`,
          //       targetValue: plan.target_value,
          //       krTitle: plan.employeeKr?.title,
          //     });
          //   });
          // }
          // setAlignmentWeeklyOptions(options);
        })
        .catch(console.error);
    }
  }, [wWeekNum, weekModal, objective]);

  const monthPlanOptions = useMemo(
    () =>
      monthPlans.map((p: any) => ({
        id: p.id,
        label: `Month ${p.month_number}: ${p.title || "Plan"}`,
      })),
    [monthPlans],
  );

  const weeklyPlanOptionsForDp = useMemo(
    () =>
      weeklyPlans.map((w: any) => ({
        id: w.id,
        title: `Week ${w.week_number}: ${w.title || "Plan"}`,
        tasks: okrAsArray(w.tasks).map((t: any) => ({
          id: t.id,
          title: t.title,
          targetValue: Number(t.target_value || 0),
        })),
      })),
    [weeklyPlans],
  );

  const handleDailyPlanWeeklyPlanChange = (wId: number) => {
    const w = weeklyPlans.find((p: any) => p.id === wId);
    if (!w) return;
    setDpSelectedWeeklyPlanIds([wId]);
    if (w.tasks?.[0]?.id) setDpSelectedTaskIds([w.tasks[0].id]);
    setDpMonthPlanId(Number(w.employee_month_plan_id));
    setDpWeekNumber(Number(w.week_number));
    const firstTask = w.tasks?.[0];
    setDpKrTargets({
      [wId]: {
        target: firstTask?.target_value
          ? Number(firstTask.target_value)
          : w.target_value
            ? Number(w.target_value)
            : "",
        initial: w.current_value ? Number(w.current_value) : "",
        metricId: w.metric_definition_id ? Number(w.metric_definition_id) : "",
        isDirect: true,
      },
    });
  };

  const openCreateKr = () => {
    setKrEditId(null);
    setKrTitle("");
    setKrDesc("");
    applyParentDefaults();
    if (krMetricId === "" && metricDefinitions[0]) {
      setKrMetricId(metricDefinitions[0].id);
    }
    setKrWeight(50);
    setKrAssignedEmployeeIds([]);
    setKrLockedEmployeeIds([]);
    setKrIsDirect(true);
    setKrModal(true);
  };

  const handleKrMetricChange = (mid: number | "") => {
    setKrMetricId(mid);
    if (mid !== "") {
      const m = metricDefinitions.find((def) => def.id === mid);
      if (m?.unit_of_measure) {
        setKrUnit(m.unit_of_measure);
      }
    }
  };

  const handleMMetricChange = (mid: number | "") => {
    setMMetricId(mid);
  };

  const openEditKr = (row: KrRow) => {
    setKrEditId(row.id);
    setKrTitle(row.title);
    setKrDesc(row.description ?? "");
    setKrMetricId(
      row.metric_definition_id != null ? Number(row.metric_definition_id) : "",
    );
    setKrTarget(
      row.target_value != null && String(row.target_value).trim() !== ""
        ? Number(row.target_value)
        : "",
    );
    setKrUnit(
      (typeof row.unit_of_measure === "string" && row.unit_of_measure) || "",
    );
    setKrWeight(row.weight_percent != null ? Number(row.weight_percent) : 50);
    setKrAssignedEmployeeIds(
      (row.contributors || []).map((c: any) => String(c.user_id)),
    );
    setKrLockedEmployeeIds(
      (row.contributors || [])
        .filter((c: any) => !!c.employeeObjectives)
        .map((c: any) => String(c.user_id)),
    );
    setKrIsDirect((row as any).is_direct !== false);
    setKrModal(true);
  };

  const handleCreateKr = async () => {
    if (!objectiveId || !krTitle.trim()) return;
    if (krMetricId === "") {
      ToastService.error("Select a metric for this key result.");
      return;
    }
    const target = krTarget === "" ? 100 : Number(krTarget);
    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.employeeKRs(objectiveId),
        body: {
          title: krTitle.trim(),
          description: krDesc.trim() || undefined,
          metric_definition_id: Number(krMetricId),
          target_value: target,
          unit_of_measure: krUnit.trim() || "%",
          weight_percent: krWeight,
          is_direct: krIsDirect,
          contributor_user_ids: krAssignedEmployeeIds,
        },
        isSecureRoute: true,
      });
      ToastService.success("Employee KR created.");
      setKrModal(false);
      await loadCore();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  const handleSaveKr = async () => {
    if (krEditId == null) {
      await handleCreateKr();
      return;
    }
    if (!krTitle.trim()) return;
    const target = krTarget === "" ? undefined : Number(krTarget);
    try {
      await makeCall({
        method: "PUT",
        route: apiRoutes.okr.employeeKRById(krEditId),
        body: {
          title: krTitle.trim(),
          ...(target !== undefined && !Number.isNaN(target)
            ? { target_value: target }
            : {}),
          weight_percent: krWeight,
          ...(krUnit.trim() ? { unit_of_measure: krUnit.trim() } : {}),
          is_direct: krIsDirect,
          contributor_user_ids: krAssignedEmployeeIds,
        },
        isSecureRoute: true,
      });
      ToastService.success("Key result updated.");
      setKrModal(false);
      await loadCore();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  const handleExecutionModeChange = async (
    krId: number,
    mode: "DIRECT_ADOPTION" | "CUSTOMIZED",
  ) => {
    setModeUpdatingKrId(krId);
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.employeeKRExecutionMode(krId),
        body: { execution_mode: mode },
        isSecureRoute: true,
      });
      ToastService.success("Execution mode updated.");
      await loadCore();
      if (selectedKrId === krId) {
        await loadKrScoped();
      }
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setModeUpdatingKrId(null);
    }
  };

  const handlePublishObjective = async () => {
    if (!objectiveId) return;
    setPublishBusy(true);
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.publishEmployeeObjective(objectiveId),
        isSecureRoute: true,
      });
      ToastService.success("Objective submitted for publication.");
      await loadCore();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setPublishBusy(false);
    }
  };

  const handleSubmitObjective = async () => {
    if (!objectiveId) return;
    setPublishBusy(true);
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.submitEmployeeObjective(objectiveId),
        isSecureRoute: true,
      });
      ToastService.success("Objective submitted for approval.");
      await loadCore();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setPublishBusy(false);
    }
  };

  const handlePublishKr = async (krId: number) => {
    setPublishBusy(true);
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.publishEmployeeKR(krId),
        isSecureRoute: true,
      });
      ToastService.success("Key result submitted for publication.");
      await loadCore();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setPublishBusy(false);
    }
  };

  const handleSubmitKr = async (krId: number) => {
    setPublishBusy(true);
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.submitEmployeeKR(krId),
        isSecureRoute: true,
      });
      ToastService.success("Key result submitted for approval.");
      await loadCore();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setPublishBusy(false);
    }
  };

  const handleBulkPublish = async () => {
    if (!objectiveId) return;
    const draftKrIds = krs
      .filter((k) => String(k.status_code ?? "").toLowerCase() === "draft")
      .map((k) => k.id);
    setPublishBusy(true);
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.employeeBulkPublish,
        body: {
          objective_ids: [Number(objectiveId)],
          kr_ids: draftKrIds,
        },
        isSecureRoute: true,
      });
      ToastService.success("Bulk publish request sent.");
      await loadCore();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setPublishBusy(false);
    }
  };

  const handleBulkSubmitPlans = async (
    mIds?: number[],
    wIds?: number[],
    dIds?: number[],
  ) => {
    const finalMonthIds = mIds ?? Array.from(selectedMonthPlanIds);
    const finalWeekIds = wIds ?? Array.from(selectedWeeklyPlanIds);
    const finalDayIds = dIds ?? Array.from(selectedDailyPlanIds);

    if (
      finalMonthIds.length === 0 &&
      finalWeekIds.length === 0 &&
      finalDayIds.length === 0
    ) {
      ToastService.error("No plans selected for submission.");
      return;
    }
    setPublishBusy(true);
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.employeeBulkSubmitPlans,
        body: {
          month_plan_ids: finalMonthIds,
          weekly_plan_ids: finalWeekIds,
          daily_plan_ids: finalDayIds,
        },
        isSecureRoute: true,
      });
      ToastService.success("Selected plans submitted for approval.");
      if (!mIds) setSelectedMonthPlanIds(new Set());
      if (!wIds) setSelectedWeeklyPlanIds(new Set());
      if (!dIds) setSelectedDailyPlanIds(new Set());
      await loadCore();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setPublishBusy(false);
    }
  };

  const handleBulkPublishPlans = async (
    mIds?: number[],
    wIds?: number[],
    dIds?: number[],
  ) => {
    const finalMonthIds = mIds ?? Array.from(selectedMonthPlanIds);
    const finalWeekIds = wIds ?? Array.from(selectedWeeklyPlanIds);
    const finalDayIds = dIds ?? Array.from(selectedDailyPlanIds);

    if (
      finalMonthIds.length === 0 &&
      finalWeekIds.length === 0 &&
      finalDayIds.length === 0
    ) {
      ToastService.error("No plans selected for publishing.");
      return;
    }
    setPublishBusy(true);
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.employeeBulkPublishPlans,
        body: {
          month_plan_ids: finalMonthIds,
          weekly_plan_ids: finalWeekIds,
          daily_plan_ids: finalDayIds,
        },
        isSecureRoute: true,
      });
      ToastService.success("Selected plans published.");
      if (!mIds) setSelectedMonthPlanIds(new Set());
      if (!wIds) setSelectedWeeklyPlanIds(new Set());
      if (!dIds) setSelectedDailyPlanIds(new Set());
      await loadCore();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setPublishBusy(false);
    }
  };

  const handleCreateMonth = async () => {
    if (mItems.length === 0 || !mItems.some((it) => it.krId)) return;
    if (mDesc === "") return;

    setSubmitting(true);
    try {
      const payloadItems = mItems
        .filter((it) => it.krId)
        .map((item) => ({
          employee_kr_id: item.krId,
          title: item.title || `Month ${mMonthNum} Plan Item`,
          target_value: Number(item.target || 0),
          current_value: Number(item.initial || 0),
          parent_employee_month_plan_item_id: item.managerMonthPlanItemId
            ? Number(item.managerMonthPlanItemId)
            : undefined,
          metric_definition_id: item.metricId
            ? Number(item.metricId)
            : undefined,
          is_direct: item.isDirect !== false,
        }));

      if (mEditId != null) {
        // Update existing plan
        const payload: any = {
          description: mDesc.trim(),
          items: payloadItems,
        };
        await makeCall({
          method: "PUT",
          route: apiRoutes.okr.employeeMonthPlanById(mEditId),
          body: payload,
          isSecureRoute: true,
        });
        ToastService.success("Monthly plan updated.");
      } else {
        await makeCall({
          method: "POST",
          route:
            apiRoutes.okr.employeeObjectives + `/${objectiveId}/month-plans`,
          body: {
            month_number: mMonthNum,
            title: `Month ${mMonthNum} Plan`,
            description: mDesc.trim(),
            items: payloadItems,
          },
          isSecureRoute: true,
        });
        ToastService.success("Monthly plan created.");
      }
      setMonthModal(false);
      void loadCore();
    } catch (err: any) {
      console.error(err);
      ToastService.error(
        err?.response?.data?.message || "Failed to save monthly plan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateWeek = async () => {
    if (
      wMonthPlanId === "" ||
      wItems.length === 0 ||
      !wItems.some((it) => it.krId)
    )
      return;
    setSubmitting(true);
    try {
      const payloadItems = wItems
        .filter((it) => it.krId)
        .map((item) => {
          const tasks = item.tasks || [];
          const calculatedTarget = tasks.reduce(
            (s: any, t: any) => s + (t.targetValue || 0),
            0,
          );
          const calculatedInitial = tasks.reduce(
            (s: any, t: any) => s + (t.currentValue || 0),
            0,
          );

          const monthItem = wKrOptions.find(
            (o) => String(o.id) === String(item.krId),
          );

          const alignmentOpt = alignmentWeeklyOptions.find(
            (opt) => Number(opt.id) === Number(item.managerWeeklyPlanId),
          );

          return {
            employee_kr_id: monthItem?.employeeKrId || item.krId,
            employee_month_plan_item_id: monthItem?.id
              ? Number(monthItem.id)
              : undefined,
            parent_weekly_plan_id:
              item.managerWeeklyPlanId && !alignmentOpt?.weeklyPlanId
                ? Number(item.managerWeeklyPlanId)
                : undefined,
            parent_weekly_task_id:
              item.managerWeeklyPlanId && alignmentOpt?.weeklyPlanId
                ? Number(item.managerWeeklyPlanId)
                : undefined,
            target_value: calculatedTarget,
            current_value: calculatedInitial,
            metric_definition_id: item.metricId
              ? Number(item.metricId)
              : monthItem?.metricId || undefined,
            blockers: item.blockers || "",
            tasks: tasks.map((t: any) => ({
              title: t.title || "Task",
              targetValue: Number(t.targetValue || 0),
              currentValue: Number(t.currentValue || 0),
            })),
            is_direct: item.isDirect !== false,
          };
        });

      if (!wEditId) {
        await makeCall({
          method: "POST",
          route: apiRoutes.okr.monthWeeklyPlans(Number(wMonthPlanId)),
          body: {
            week_number: wWeekNum,
            title: wTitle.trim() || `Week ${wWeekNum} Plan`,
            description: wDesc.trim(),
            items: payloadItems,
          },
          isSecureRoute: true,
        });
        ToastService.success("Weekly plan created.");
      } else {
        await makeCall({
          method: "PUT",
          route: apiRoutes.okr.weeklyPlans(wEditId),
          body: {
            title: wTitle.trim(),
            description: wDesc.trim(),
            blockers: payloadItems[0]?.blockers,
            employee_month_plan_id: wMonthPlanId ? Number(wMonthPlanId) : undefined,
            metric_definition_id: payloadItems[0]?.metric_definition_id,
            target_value: payloadItems[0]?.target_value,
            current_value: payloadItems[0]?.current_value,
            is_direct: payloadItems[0]?.is_direct,
            tasks: payloadItems[0]?.tasks,
          },
          isSecureRoute: true,
        });
        ToastService.success("Weekly plan updated.");
      }
      setWeekModal(false);
      void loadCore();
    } catch (err: any) {
      console.error(err);
      ToastService.error(
        err?.response?.data?.message || "Failed to save weekly plan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDailyPlan = async () => {
    if (!dpTitle.trim()) return;
    setSubmitting(true);
    try {
      if (dpEditId != null) {
        // Edit flow (single daily plan) - remains unchanged since editing is per item
        await makeCall({
          method: "PUT",
          route: apiRoutes.okr.employeeDailyPlanById(dpEditId),
          body: {
            title: dpTitle.trim(),
            description: dpDesc.trim() || undefined,
            weekly_task_ref: dpWeeklyTaskRef.trim() || undefined,
            completion_day: dpCompletionDay,
            // Editing might still need scalar values depending on how it's handled,
            // but for batch creation we are changing the focus. If editing is broken,
            // we will need to address it. For now, let's keep the target/current update simple if available.
            // Since we removed dpTargetValue state, editing might need those fields restored or handled via dpKrTargets.
            // Wait, editing single daily plan:
            target_value:
              dpSelectedWeeklyPlanIds.length > 0
                ? dpKrTargets[dpSelectedWeeklyPlanIds[0]]?.target
                : undefined,
            current_value:
              dpSelectedWeeklyPlanIds.length > 0
                ? dpKrTargets[dpSelectedWeeklyPlanIds[0]]?.initial
                : undefined,
          },
          isSecureRoute: true,
        });
        ToastService.success("Daily plan updated.");
      } else {
        // Batch creation
        if (dpSelectedTaskIds.length === 0) {
          ToastService.error("Please select at least one task.");
          setSubmitting(false);
          return;
        }

        const items = dpSelectedTaskIds.map((taskId) => {
          const vals = dpKrTargets[taskId] || {
            target: "",
            initial: "",
            metricId: "",
            isDirect: true,
          };
          
          return {
            weekly_task_id: taskId,
            target_value: Number(vals.target || 0),
            current_value: Number(vals.initial || 0),
            metric_definition_id: vals.metricId
              ? Number(vals.metricId)
              : undefined,
            is_direct: vals.isDirect !== false,
          };
        });

        await makeCall({
          method: "POST",
          route: apiRoutes.okr.batchDailyPlans,
          body: {
            completion_day: dpCompletionDay,
            title: dpTitle.trim(),
            description: dpDesc.trim() || undefined,
            items,
          },
          isSecureRoute: true,
        });
        ToastService.success("Daily plans created.");
      }
      setDailyPlanModal(false);
      setDpEditId(null);
      setDpMonthPlanId(null);
      setDpWeekNumber(null);
      setDpSelectedWeeklyPlanIds([]);
      setDpSelectedTaskIds([]);
      setDpKrTargets({});
      setDpTitle("");
      setDpDesc("");
      setDpWeeklyTaskRef("");
      setDpCompletionDay("MONDAY");
      await Promise.all([loadKrScoped(), loadCore()]);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteDailyPlan = async (dailyPlanId: number) => {
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.employeeDailyPlanById(dailyPlanId),
        body: { status_code: "completed" },
        isSecureRoute: true,
      });
      ToastService.success("Daily plan marked complete.");
      await loadKrScoped();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  const handleCreateSubtask = async () => {
    if (!selectedKrId || !subTitle.trim()) return;
    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.employeeKRSubtasks(selectedKrId),
        body: {
          title: subTitle.trim(),
          description: subDesc.trim() || undefined,
          target_month: subMonth,
          target_week: subWeek,
        },
        isSecureRoute: true,
      });
      ToastService.success("Subtask created.");
      setSubOpen(false);
      setSubTitle("");
      setSubDesc("");
      await loadKrScoped();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  const handleSubtaskStatus = async (
    subtaskId: number,
    status_code: string,
  ) => {
    try {
      await makeCall({
        method: "PUT",
        route: apiRoutes.okr.employeeSubtaskById(subtaskId),
        body: { status_code },
        isSecureRoute: true,
      });
      await loadKrScoped();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  const openProgressModal = (
    krId?: number,
    weekNum?: number,
    monthNum?: number,
    dailyPlanId?: number,
    currentValue?: number,
    targetValue?: number,
  ) => {
    console.log("[DEBUG] openProgressModal Args:", {
      krId,
      weekNum,
      monthNum,
      dailyPlanId,
      currentValue,
      targetValue,
    });
    const targetKrId = krId || selectedKrId;
    const kr = krs.find((k) => k.id === targetKrId);
    if (!kr) {
      ToastService.error("No key result selected.");
      return;
    }

    if (krId) setSelectedKrId(krId);
    if (weekNum) setProgWeek(weekNum);
    if (monthNum) setProgMonth(monthNum);

    setProgValue(
      currentValue ?? Number(kr.current_value ?? kr.final_value ?? 0),
    );
    setProgTarget(targetValue ?? Number(kr.target_value ?? 0));
    setProgIsCompleted(
      String(kr.status_code ?? "").toLowerCase() === "completed",
    );
    setNote("");
    setBlocked(false);
    setProgDailyPlanId(dailyPlanId || null);
    setProgModal(true);
  };

  const openDailyProgressModal = (
    krId: number,
    weekNum: number,
    monthNum: number,
    dailyPlanId: number,
    currentValue: number,
    targetValue: number,
    taskTitle: string,
    dailyTitle: string,
    day: string,
  ) => {
    console.log("[DEBUG] openDailyProgressModal Args:", {
      krId,
      dailyPlanId,
      currentValue,
      targetValue,
    });
    setSelectedKrId(krId);
    setProgWeek(weekNum);
    setProgMonth(monthNum);
    setProgDailyPlanId(dailyPlanId);
    setProgValue(currentValue);
    setProgTarget(targetValue);
    setDailyProgContext({ taskTitle, dailyTitle, day });
    setDailyProgModal(true);
  };

  const handleProgress = async () => {
    if (!selectedKrId) {
      ToastService.error("No key result selected.");
      return;
    }

    // Basic validation
    if (!note.trim() && !blocked) {
      ToastService.error("Please add a comment or mark as blocked.");
      return;
    }

    console.log("[DEBUG] handleProgress Payload:", {
      week_number: Number(progWeek),
      month_number: Number(progMonth),
      daily_plan_id: progDailyPlanId,
      current_value: progValue,
      target_value: progTarget,
      blocked,
      note,
    });
    setProgModal(false); // close early for better UX
    setDailyProgModal(false);

    try {
      const payload: Record<string, any> = {
        week_number: Number(progWeek),
        month_number: Number(progMonth),
        daily_plan_id: progDailyPlanId || undefined,
        current_value: String(progValue),
        target_value: progTarget !== undefined ? String(progTarget) : undefined,
        blockers: blocked ? note.trim() : undefined,
        comment: !blocked ? note.trim() || undefined : undefined,
        is_completed: progIsCompleted,
      };

      await makeCall({
        method: "POST",
        route: apiRoutes.okr.employeeKRProgress(selectedKrId),
        body: payload,
        isSecureRoute: true,
      });

      ToastService.success("Progress updated.");
      setProgModal(false);
      setDailyProgModal(false);
      setNote("");
      setBlocked(false);
      await Promise.all([loadKrScoped(), loadCore()]);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  const handleProgressKrChange = (krId: number) => {
    setSelectedKrId(krId);
    const kr = krs.find((k) => k.id === krId);
    if (kr) {
      setProgValue(Number(kr.current_value ?? kr.final_value ?? 0));
      setProgTarget(Number(kr.target_value ?? 0));
    }
  };

  const openAssignModal = (
    krId: number,
    title: string,
    isEmployee: boolean = false,
  ) => {
    setAssignTargetKrId(krId);
    setAssignTargetTitle(title);
    setAssignTargetIsEmployee(isEmployee);
    setSelectedSubordinateId("");
    setAssignModal(true);
  };

  const handleAssignContributor = async () => {
    if (!assignTargetKrId || !selectedSubordinateId) return;
    setAssignLoading(true);
    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.contributors,
        body: {
          department_kr_id: !assignTargetIsEmployee
            ? assignTargetKrId
            : undefined,
          employee_kr_id: assignTargetIsEmployee ? assignTargetKrId : undefined,
          user_id: selectedSubordinateId,
          role_type: "EMPLOYEE",
          is_required_for_completion: isRequiredContributor,
        },
        isSecureRoute: true,
      });
      ToastService.success("Contributor assigned successfully.");
      setAssignModal(false);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setAssignLoading(false);
    }
  };

  const draftKrs = krs.filter(
    (k) => String(k.status_code ?? "").toLowerCase() === "draft",
  );

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white -mx-4 md:-mx-8 px-4 md:px-8">
        <ExecutionShell
          breadcrumbs={[
            { label: "My execution", to: routeConstants.okrMyExecution },
            { label: objectiveTitle || "Objective" },
          ]}
          title={loading ? "Loading..." : objectiveTitle}
          subtitle="Employee Execution: KRs, Plans, Daily Plans, And Progress For The Open Cycle."
          actions={
            <div className="flex flex-wrap gap-2 justify-end">
              {draftKrs.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={MdPublish}
                  loading={publishBusy}
                  onClick={() => void handleBulkPublish()}
                >
                  Publish All
                </Button>
              )}
              {["draft", "changes_requested"].includes(
                objectiveStatus?.toLowerCase() || "draft",
              ) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={MdSend}
                    loading={publishBusy}
                    onClick={() => void handleSubmitObjective()}
                  >
                    Submit Objective
                  </Button>
                )}
              {objectiveStatus?.toLowerCase() === "approved" && (
                <Button
                  variant="white"
                  size="sm"
                  icon={MdPublish}
                  loading={publishBusy}
                  onClick={() => void handlePublishObjective()}
                >
                  Publish Objective
                </Button>
              )}
            </div>
          }
        >
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`cursor-pointer inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-200 ${tab === t.id
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white text-k-medium-grey ring-1 ring-gray-200 hover:bg-k-light-grey hover:text-k-dark-grey"
                  }`}
              >
                <t.icon className="text-lg" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 min-h-[240px] mt-4">
            {tab === "overview" && (
              <div className="space-y-4 text-sm text-gray-600 max-w-3xl">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500">Cycle</p>
                    <p className="text-gray-900 font-semibold">
                      {cycleLabel || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-primary mb-1 uppercase tracking-wider">Direct Progress</p>
                        <ProgressBar
                          percent={
                            objectiveTargetValue > 0
                              ? (objectiveCurrentValue / objectiveTargetValue) * 100
                              : 0
                          }
                          className="w-full h-1.5"
                        />
                      </div>
                      {objectiveIndirectScore !== "—" && Number(objectiveIndirectScore) > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Indirect Contribution</p>
                            {objectiveIndirectTarget > 0 && (
                              <span className="text-[10px] text-indigo-400 tabular-nums">
                                {Number(objectiveIndirectValue) > 0 ? Number(objectiveIndirectValue).toLocaleString() : 0}
                                {" / "}{objectiveIndirectTarget.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <ProgressBar
                            percent={Number(objectiveIndirectScore)}
                            className="w-full h-1.5"
                            color="bg-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500">
                      Value Rollup
                    </p>
                    <div className="space-y-1">
                      <p className="text-gray-900 font-semibold tabular-nums">
                        {objectiveFinalValue} <span className="text-[10px] font-normal text-gray-500">(Direct)</span>
                        {objectiveTargetValue > 0 && (
                          <span className="text-[10px] font-normal text-gray-400 ml-1">/ {objectiveTargetValue.toLocaleString()}</span>
                        )}
                      </p>
                      {objectiveIndirectValue !== "—" && Number(objectiveIndirectValue) > 0 && (
                        <p className="text-indigo-600 font-semibold tabular-nums text-xs">
                          {objectiveIndirectValue}
                          {objectiveIndirectTarget > 0 && (
                            <span className="text-[10px] font-normal text-indigo-400 ml-1">/ {objectiveIndirectTarget.toLocaleString()}</span>
                          )}
                          <span className="text-[10px] font-normal text-indigo-400 ml-1">(Indirect)</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 pt-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Parent Resource KR
                    </p>
                    <h4 className="font-bold text-gray-900 text-sm">
                      {parentKrTitle}
                    </h4>
                    {parentKrDescription ? (
                      <BulletText
                        text={parentKrDescription}
                        className="text-gray-600 mt-2 text-xs"
                      />
                    ) : null}
                  </div>
                </div>

                {activityLog.length > 0 ? (
                  <div>
                    {/*<p className="text-xs font-medium text-gray-500 mb-2">
                      Recent Activity
                    </p>
                    <ul className="space-y-2 max-h-48 overflow-y-auto text-xs">
                      {activityLog.slice(0, 8).map((a: any) => (
                        <li
                          key={a.id ?? JSON.stringify(a.created_at)}
                          className="rounded-lg border border-gray-100 px-3 py-2"
                        >
                          <span className="text-gray-500">
                            {a.created_at
                              ? new Date(a.created_at).toLocaleString()
                              : ""}
                          </span>
                          <p className="text-gray-800 mt-0.5">
                            {a.description}
                          </p>
                        </li>
                      ))}
                    </ul>*/}
                  </div>
                ) : null}
              </div>
            )}
            {tab === "krs" && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between gap-2 items-center">
                  <p className="text-xs text-gray-500">
                    {draftKrs.length} draft KR{draftKrs.length === 1 ? "" : "s"}{" "}
                    Will Be Included In Bulk Publish.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["draft", "changes_requested"].includes(
                      krs
                        .find((k) => k.id === selectedKrId)
                        ?.status_code?.toLowerCase() || "draft",
                    ) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={MdSend}
                          disabled={!selectedKrId}
                          loading={publishBusy}
                          onClick={() =>
                            selectedKrId && void handleSubmitKr(selectedKrId)
                          }
                        >
                          Submit Selected KR
                        </Button>
                      )}
                    {krs
                      .find((k) => k.id === selectedKrId)
                      ?.status_code?.toLowerCase() === "approved" && (
                        <Button
                          variant="white"
                          size="sm"
                          icon={MdPublish}
                          disabled={!selectedKrId}
                          loading={publishBusy}
                          onClick={() =>
                            selectedKrId && void handlePublishKr(selectedKrId)
                          }
                        >
                          Publish Selected KR
                        </Button>
                      )}

                    <Button
                      variant="primary"
                      size="sm"
                      icon={MdAdd}
                      onClick={openCreateKr}
                      disabled={maxKrs !== null && krs.length >= maxKrs}
                      title={
                        maxKrs !== null && krs.length >= maxKrs
                          ? `Maximum limit of ${maxKrs} KRs reached`
                          : ""
                      }
                    >
                      Add Employee KR
                    </Button>
                  </div>
                </div>
                {krs.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No Employee KRs Yet. Create One To Attach Plans And
                    Progress. Choose Execution Mode From My Execution If You
                    Have Not Created A KR Yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                    {krs.map((k: any) => {
                      const target = Number(k.target_value ?? 0);
                      const current = Number(k.current_value ?? 0);
                      const pct =
                        target > 0
                          ? Number(((current / target) * 100).toFixed(2))
                          : 0;
                      const status = String(
                        k.status_code ?? k.status ?? "",
                      ).toLowerCase();

                      return (
                        <li
                          key={k.id}
                          className="rounded-xl border border-gray-100 bg-white p-5 space-y-5 transition-all hover:shadow-md"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-1.5 flex-1 min-w-[200px]">
                              <div className="flex items-center gap-3">
                                <h4 className="font-bold text-gray-900">
                                  {k.title}
                                </h4>
                                <OkrStatusBadge
                                  label={formatStatusLabel(status || "Draft")}
                                  tone={resolveStatusTone(status)}
                                  size="xs"
                                />
                              </div>
                              {k.contributors && k.contributors.length > 0 && (
                                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-50">
                                  <div className="flex -space-x-2">
                                    {k.contributors
                                      .slice(0, 4)
                                      .map((c: any) => (
                                        <div
                                          key={c.id}
                                          className="h-8 w-8 rounded-full ring-2 ring-white bg-white flex items-center justify-center overflow-hidden shadow-sm hover:-translate-y-0.5 transition-transform cursor-help group relative"
                                          title={
                                            c.user?.employee?.full_name ||
                                            c.user_id
                                          }
                                        >
                                          <div className="w-full h-full bg-gradient-to-tr from-primary/10 to-primary/30 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-primary">
                                              {(c.user?.employee?.full_name ||
                                                c.user_id)[0]?.toUpperCase()}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    {k.contributors.length > 4 && (
                                      <div className="h-8 w-8 rounded-full ring-2 ring-white bg-slate-50 flex items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-500">
                                          +{k.contributors.length - 4}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] leading-tight">
                                      Ownership
                                    </span>
                                    <span className="text-xs font-medium text-slate-600 truncate max-w-[200px]">
                                      {k.contributors
                                        .map(
                                          (c: any) =>
                                            c.user?.employee?.full_name ||
                                            c.user_id,
                                        )
                                        .join(", ")}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {k.description && (
                                <BulletText
                                  text={k.description}
                                  className="text-sm text-gray-500"
                                />
                              )}

                              {(k as any).approvalLogs?.[0]?.action ===
                                "CHANGES_REQUESTED" ||
                                (k as any).approvalLogs?.[0]?.action ===
                                "REJECTED" ? (
                                <div className="mt-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 ring-1 ring-red-100 italic">
                                  <span className="font-bold tracking-widest text-[9px] block mb-1">
                                    Manager Feedback:
                                  </span>
                                  {(k as any).approvalLogs[0].comments ||
                                    "Please Review And Adjust The Targets."}
                                </div>
                              ) : null}
                            </div>

                            <div className="shrink-0 flex flex-col sm:items-end gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-50">
                              {/*<div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  Execution mode
                                </label>
                                <select
                                  value={
                                    fromBackendExecutionMode(
                                      k.execution_mode,
                                    ) === "custom_adoption"
                                      ? "CUSTOMIZED"
                                      : "DIRECT_ADOPTION"
                                  }
                                  onChange={(e) =>
                                    void handleExecutionModeChange(
                                      k.id,
                                      e.target.value as
                                        | "DIRECT_ADOPTION"
                                        | "CUSTOMIZED",
                                    )
                                  }
                                  disabled={
                                    String(
                                      k.status_code ?? "",
                                    ).toLowerCase() !== "draft" ||
                                    modeUpdatingKrId === k.id
                                  }
                                  className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-k-dark-grey focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-40"
                                >
                                  <option value="DIRECT_ADOPTION">
                                    Direct adoption
                                  </option>
                                  <option value="CUSTOMIZED">
                                    Custom adoption
                                  </option>
                                </select>
                              </div>*/}
                              <div className="flex items-center gap-2 w-full sm:justify-end">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openEditKr(k)}
                                >
                                  Edit KR
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-5 border-t border-gray-50">
                              <div className="flex flex-col gap-4">
                                <div className="space-y-2 flex-1">
                                  <div className="flex justify-between items-end text-xs font-bold tracking-tighter">
                                    <span className="text-gray-400 uppercase tracking-widest text-[10px]">
                                      Direct Progress
                                    </span>
                                    <span className="text-primary">
                                      {pct}%
                                    </span>
                                  </div>
                                  <ProgressBar
                                    percent={pct}
                                    className="h-2 shadow-inner rounded-full"
                                  />
                                </div>

                              </div>

                            <div className="flex flex-wrap items-center gap-8 md:justify-end">
                              <div className="text-center md:text-right">
                                <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">
                                  Weight
                                </p>
                                <p className="text-2xl font-black text-gray-400 leading-none">
                                  {k.weight_percent}%
                                </p>
                              </div>
                              <div className="text-center md:text-right">
                                <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">
                                  Type
                                </p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${k.is_direct !== false ? "bg-primary/10 text-primary" : "bg-indigo-50 text-indigo-600"}`}>
                                  {k.is_direct !== false ? "Direct" : "Indirect"}
                                </span>
                              </div>
                            </div>

                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            {tab === "monthly" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {!isExecutionEnabled && (
                    <p className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                      <MdWarningAmber className="text-base text-amber-600 shrink-0" />
                      Monthly Plans Can Only Be Added To Approved Or Published
                      KRs.
                    </p>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    icon={MdAdd}
                    disabled={!selectedKrId || !isExecutionEnabled}
                    onClick={() => {
                      setMEditId(null);
                      const maxMonth = monthPlans.reduce((max, p) => {
                        const n = Number(p.month_number ?? p.monthNumber ?? 0);
                        return n > max ? n : max;
                      }, 0);
                      setMMonthNum(maxMonth + 1);
                      setMSelectedKrId(selectedKrId ?? "");
                      setMDesc("");
                      setMMetricId("");
                      setMContributeScore(true);
                      setMContributeValue(true);
                      setMAlignment(null);
                      setMItems([
                        {
                          id: Date.now().toString(),
                          krId: selectedKrId || "",
                          title: "",
                          target: "",
                          initial: "",
                          metricId: "",
                          managerMonthPlanItemId: "",
                        },
                      ]);
                      setMonthModal(true);
                    }}
                  >
                    Add Monthly Plan
                  </Button>
                </div>
                {tabLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : monthPlans.length === 0 ? (
                  <p className="text-sm text-gray-500">No Monthly Plans Yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {monthPlans.map((p: any) => {
                      const itemTargetSum = (p.items || []).reduce((s: number, it: any) => s + Number(it.target_value || it.targetValue || 0), 0);
                      const itemCurrentSum = (p.items || []).reduce((s: number, it: any) => s + Number(it.current_value || it.currentValue || 0), 0);

                      const target = Number(
                        p.target_value || p.targetValue || itemTargetSum || 0,
                      );
                      const current = Number(
                        p.current_value || p.currentValue || p.final_value || itemCurrentSum || 0,
                      );
                      const pct =
                        target > 0
                          ? Number(((current / target) * 100).toFixed(2))
                          : 0;
                      const status = String(
                        p.status_code ?? p.status ?? "",
                      ).toLowerCase();

                      return (
                        <li
                          key={p.id}
                          className="rounded-xl border border-gray-100 bg-white p-4 transition-all hover:shadow-md"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-400 tracking-widest">
                                Month {p.month_number ?? p.monthNumber ?? "?"}
                              </span>
                              {p.is_direct === false && (
                                <span className="text-[9px] font-bold bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Indirect Plan
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {status === "draft" && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={MdSend}
                                  loading={publishBusy}
                                  onClick={() => {
                                    void handleBulkSubmitPlans([Number(p.id)]);
                                  }}
                                >
                                  Submit
                                </Button>
                              )}
                              {status === "approved" && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  icon={MdPublish}
                                  loading={publishBusy}
                                  onClick={() => {
                                    void handleBulkPublishPlans([Number(p.id)]);
                                  }}
                                >
                                  Publish
                                </Button>
                              )}

                              {status !== "published" && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setMEditId(Number(p.id));
                                    setMSelectedKrId(selectedKrId ?? "");
                                    setMMonthNum(
                                      p.month_number ?? p.monthNumber ?? 1,
                                    );
                                    setMDesc(p.description ?? "");
                                    setMMetricId(
                                      p.metric_definition_id != null
                                        ? Number(p.metric_definition_id)
                                        : "",
                                    );
                                    setMContributeScore(
                                      p.contributes_to_parent_score !== false,
                                    );
                                    setMContributeValue(
                                      p.contributes_to_parent_value !== false,
                                    );
                                    setMAlignment(p.alignment || null);
                                    const mappedItems = (p.items || []).map(
                                      (it: any) => ({
                                        id: String(it.id),
                                        krId: it.employee_kr_id,
                                        title: it.title || "",
                                        target: it.target_value ?? "",
                                        initial: it.current_value ?? "",
                                        metricId: it.metric_definition_id ?? "",
                                        managerMonthPlanItemId:
                                          it.parent_employee_month_plan_item_id ??
                                          "",
                                      }),
                                    );
                                    setMItems(mappedItems);
                                    setMonthModal(true);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              <OkrStatusBadge
                                label={formatStatusLabel(status || "Draft")}
                                tone={resolveStatusTone(status)}
                                size="xs"
                              />
                            </div>
                          </div>

                          <BulletText
                            text={p.description ?? "—"}
                            className="text-sm text-gray-700 font-medium mb-3"
                          />

                          <div className="space-y-1.5 pt-2 border-t border-gray-50">
                            <div className="flex justify-between text-[11px] font-medium text-gray-500 mb-1">
                              <span>
                                Monthly Progress: {current} / {target}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2">
                              <div>
                                <ProgressBar percent={pct} />
                              </div>
                            </div>
                            {p.alignment && (
                              <div
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-2 ${p.alignment.isAligned ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}
                              >
                                {p.alignment.isAligned
                                  ? "Aligned with Manager"
                                  : `Gap: ${p.alignment.gap} units`}
                              </div>
                            )}

                            {/* Accordion for Items */}
                            {(p.items || []).length > 0 && (
                              <details className="mt-4 group border-t border-gray-50 pt-2">
                                <summary className="cursor-pointer list-none flex items-center justify-between text-[11px] font-bold text-primary tracking-wider hover:text-primary-dark transition-colors">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px]">
                                      {(p.items || []).length} Items
                                    </span>
                                    <span>Detailed Breakdown</span>
                                  </div>
                                  <MdChevronRight className="text-lg group-open:rotate-90 transition-transform text-gray-400" />
                                </summary>
                                <div className="mt-3 space-y-4">
                                  {(p.items || []).map((it: any) => {
                                    const itTarget = Number(
                                      it.target_value || 0,
                                    );
                                    const itCurrent = Number(
                                      it.current_value || 0,
                                    );
                                    const itPct =
                                      itTarget > 0
                                        ? Number(
                                          (
                                            (itCurrent / itTarget) *
                                            100
                                          ).toFixed(2),
                                        )
                                        : 0;

                                    return (
                                      <div
                                        key={it.id}
                                        className="pl-4 border-l-2 border-primary/20 bg-gray-50/30 p-2 rounded-r-lg"
                                      >
                                        <div className="flex justify-between items-start mb-2">
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-bold text-gray-800">
                                              {it.title || "Untitled Item"}
                                            </span>
                                            {it.employeeKr?.title && (
                                              <span className="text-[10px] text-gray-400 font-medium italic">
                                                KR: {it.employeeKr.title}
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-right">
                                            <span className="text-[10px] font-bold text-gray-400 tracking-tighter">
                                              Target
                                            </span>
                                            <div className="text-xs font-bold text-gray-800">
                                              {itTarget}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="space-y-1">
                                          <div className="flex justify-between items-center text-[10px] font-bold">
                                            <span className="text-gray-500">
                                              Progress
                                            </span>
                                            <span className="text-primary">
                                              {itCurrent} / {itTarget} ({itPct}
                                              %)
                                            </span>
                                          </div>
                                          <ProgressBar
                                            percent={itPct}
                                            size="xs"
                                          />
                                        </div>

                                        {it.note && (
                                          <p className="mt-2 text-[11px] text-gray-500 leading-relaxed bg-white/50 p-2 rounded border border-gray-100">
                                            {it.note}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </details>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            {tab === "weekly" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {!isExecutionEnabled && (
                    <p className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                      <MdWarningAmber className="text-base text-amber-600 shrink-0" />
                      Weekly Plans Can Only Be Added To Approved Or Published
                      KRs.
                    </p>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    icon={MdAdd}
                    disabled={
                      !selectedKrId ||
                      monthPlans.length === 0 ||
                      !isExecutionEnabled
                    }
                    onClick={() => {
                      if (monthPlans.length === 0) {
                        ToastService.error(
                          "Please create a monthly plan first.",
                        );
                        return;
                      }
                      setWEditId(null);
                      setWWeekNum(1);
                      setWTitle("");
                      setWDesc("");
                      setWMonthPlanId(
                        monthPlans[0]?.id != null
                          ? Number(monthPlans[0].id)
                          : "",
                      );
                      setWItems([
                        {
                          id: Date.now().toString(),
                          krId: "",
                          metricId: "",
                          blockers: "",
                          tasks: [],
                          managerWeeklyPlanId: "",
                        },
                      ]);
                      setWeekModal(true);
                    }}
                  >
                    Add Weekly Plan
                  </Button>
                </div>
                {monthPlans.length === 0 ? (
                  <p className="inline-flex items-center gap-1.5 text-sm text-amber-700 font-medium">
                    <MdWarningAmber className="text-base text-amber-600 shrink-0" />
                    Create A Monthly Plan First (Backend Requires Employee Month
                    Plan ID).
                  </p>
                ) : tabLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : weeklyPlans.length === 0 ? (
                  <p className="text-sm text-gray-500">No Weekly Plans Yet.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {weeklyPlans.map((w: any) => {
                      const taskTargetSum = (w.tasks || []).reduce((s: number, t: any) => s + Number(t.target_value || t.targetValue || 0), 0);
                      const taskCurrentSum = (w.tasks || []).reduce((s: number, t: any) => s + Number(t.current_value || t.currentValue || 0), 0);
                      
                      const target = Number(
                        w.target_value || w.targetValue || taskTargetSum || 0,
                      );
                      const current = Number(
                        w.current_value || w.currentValue || taskCurrentSum || 0,
                      );
                      const pct =
                        target > 0
                          ? Number(((current / target) * 100).toFixed(2))
                          : 0;
                      const status = String(
                        w.status_code ?? w.status ?? "",
                      ).toLowerCase();

                      return (
                        <li
                          key={w.id}
                          className="rounded-xl border border-gray-100 bg-white p-4 space-y-3 transition-all hover:shadow-md"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-k-medium-grey tracking-widest">
                                  Week {w.week_number ?? w.weekNumber ?? "?"}
                                </span>
                                {w.is_direct === false && (
                                  <span className="text-[9px] font-bold bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Indirect Plan
                                  </span>
                                )}
                              </div>
                              <OkrStatusBadge
                                label={formatStatusLabel(status || "Draft")}
                                tone={resolveStatusTone(status)}
                                size="xs"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              {status === "draft" && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={MdSend}
                                  loading={publishBusy}
                                  onClick={() => {
                                    void handleBulkSubmitPlans(undefined, [
                                      Number(w.id),
                                    ]);
                                  }}
                                >
                                  Submit
                                </Button>
                              )}
                              {status === "approved" && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  icon={MdPublish}
                                  loading={publishBusy}
                                  onClick={() => {
                                    void handleBulkPublishPlans(undefined, [
                                      Number(w.id),
                                    ]);
                                  }}
                                >
                                  Publish
                                </Button>
                              )}
                              {status !== "published" && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setWEditId(Number(w.id));
                                    setWWeekNum(
                                      w.week_number ?? w.weekNumber ?? 1,
                                    );
                                    setWTitle(w.title ?? "");
                                    setWDesc(w.blockers ?? w.description ?? "");
                                    setWMonthPlanId(
                                      w.employee_month_plan_id ??
                                      w.employeeMonthPlanId ??
                                      "",
                                    );

                                    const mappedItems = (w.items || []).map(
                                      (it: any) => ({
                                        id: String(it.id),
                                        krId: it.employee_kr_id,
                                        metricId: it.metric_definition_id ?? "",
                                        blockers: it.blockers || "",
                                        managerWeeklyPlanId:
                                          it.parent_weekly_plan_id ?? "",
                                        tasks: (it.tasks || []).map(
                                          (t: any) => ({
                                            title: t.title || "",
                                            targetValue: t.target_value ?? 0,
                                            currentValue: t.current_value ?? 0,
                                          }),
                                        ),
                                        isDirect: it.is_direct !== false,
                                      }),
                                    );
                                    setWItems(mappedItems);
                                    setWeekModal(true);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                icon={MdTrendingUp}
                                disabled={!isExecutionEnabled}
                                onClick={() =>
                                  openProgressModal(
                                    Number(w.employee_kr_id),
                                    Number(w.week_number),
                                    Number(w.month_number || 1),
                                    undefined,
                                    Number(w.current_value || 0),
                                    Number(w.target_value || 0),
                                  )
                                }
                              >
                                Progress
                              </Button>
                            </div>
                          </div>

                          <BulletText
                            text={w.blockers || w.title || w.description || "—"}
                            className="text-sm text-gray-700 font-medium"
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center border-t border-gray-50 pt-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-medium text-gray-500 mb-1">
                                <span>
                                  Weekly Progress: {current} / {target}
                                </span>
                              </div>
                              <div className="flex flex-col gap-2">
                                <div>
                                  <ProgressBar percent={pct} />
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-4 text-[11px] font-semibold">
                              <div className="text-gray-400">
                                <span className="text-gray-800">
                                  {w.progress_percent ?? "0"}
                                </span>
                              </div>
                              <div className="text-gray-400">
                                Value:{" "}
                                <span className="text-gray-800">
                                  {w.current_value ?? w.final_value ?? "0"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {okrAsArray(w.tasks).length > 0 && (
                            <div className="mt-2 space-y-3 bg-gray-50/50 p-2 rounded-lg">
                              {okrAsArray(w.tasks).map((task: any) => (
                                <div key={task.id} className="space-y-1">
                                  <p className="text-[9px] font-bold text-primary/70 tracking-tight">
                                    Task: {task.title}
                                  </p>
                                  <ul className="space-y-1">
                                    {okrAsArray(task.dailyPlans).map(
                                      (m: any) => (
                                        <li
                                          key={m.id}
                                          className="flex items-center justify-between text-xs bg-white border border-gray-50 px-2 py-1 rounded shadow-sm"
                                        >
                                          <span className="text-gray-600 font-medium">
                                            {m.title}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setDpEditId(Number(m.id));
                                                setDpMonthPlanId(
                                                  Number(
                                                    w.employee_month_plan_id,
                                                  ),
                                                );
                                                setDpWeekNumber(
                                                  Number(w.week_number),
                                                );
                                                setDpSelectedWeeklyPlanIds([
                                                  Number(w.id),
                                                ]);
                                                 setDpKrTargets({
                                                  [Number(w.id)]: {
                                                    target: m.target_value
                                                      ? Number(m.target_value)
                                                      : "",
                                                    initial: m.current_value
                                                      ? Number(m.current_value)
                                                      : "",
                                                    metricId:
                                                      m.metric_definition_id
                                                        ? Number(
                                                          m.metric_definition_id,
                                                        )
                                                        : "",
                                                    isDirect: m.is_direct !== false,
                                                  },
                                                });
                                                setDpTitle(m.title ?? "");
                                                setDpDesc(m.description ?? "");
                                                setDpWeeklyTaskRef(
                                                  m.weekly_task_ref ?? "",
                                                );
                                                setDpCompletionDay(
                                                  m.completion_day ?? "MONDAY",
                                                );
                                                setDailyPlanModal(true);
                                              }}
                                              className="cursor-pointer text-k-medium-grey font-semibold hover:text-k-dark-grey transition-colors"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openDailyProgressModal(
                                                  Number(w.employee_kr_id),
                                                  Number(w.week_number),
                                                  Number(
                                                    w.employee_month_plan_id ||
                                                    1,
                                                  ),
                                                  Number(m.id),
                                                  Number(m.current_value || 0),
                                                  Number(
                                                    m.target_value ||
                                                    task.target_value ||
                                                    0,
                                                  ),
                                                  task.title || "",
                                                  m.title || "",
                                                  m.completion_day || "N/A",
                                                )
                                              }
                                              className="cursor-pointer text-primary font-semibold hover:underline transition-colors"
                                            >
                                              Progress
                                            </button>
                                            <OkrStatusBadge
                                              label={formatStatusLabel(
                                                m.status_code || "Planned",
                                              )}
                                              tone={resolveStatusTone(
                                                m.status_code,
                                              )}
                                              size="xs"
                                            />
                                            {String(
                                              m.status_code ?? "",
                                            ).toLowerCase() !== "completed" && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    void handleCompleteDailyPlan(
                                                      Number(m.id),
                                                    )
                                                  }
                                                  className="cursor-pointer text-primary font-semibold hover:underline transition-colors"
                                                >
                                                  Done
                                                </button>
                                              )}
                                          </div>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            {tab === "daily_plans" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {!isExecutionEnabled && (
                    <p className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                      <MdWarningAmber className="text-base text-amber-600 shrink-0" />
                      Daily Plans Can Only Be Managed For Approved KRs.
                    </p>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    icon={MdAdd}
                    disabled={
                      !selectedKrId ||
                      weeklyPlans.length === 0 ||
                      !isExecutionEnabled
                    }
                    onClick={() => {
                      if (weeklyPlans.length === 0) {
                        ToastService.error(
                          "Please create a weekly plan first.",
                        );
                        return;
                      }
                      setDpEditId(null);
                      // Default to first weekly plan
                      const w = weeklyPlans[0];
                      setDpMonthPlanId(Number(w.employee_month_plan_id));
                      setDpWeekNumber(Number(w.week_number));
                      setDpSelectedWeeklyPlanIds([Number(w.id)]);
                      if (w.tasks?.[0]?.id) setDpSelectedTaskIds([w.tasks[0].id]);
                      setDpKrTargets({
                        [Number(w.id)]: {
                          target: w.target_value ? Number(w.target_value) : "",
                          initial: w.current_value
                            ? Number(w.current_value)
                            : "",
                          metricId: w.metric_definition_id
                            ? Number(w.metric_definition_id)
                            : "",
                          isDirect: true,
                        },
                      });
                      setDpTitle("");
                      setDpDesc("");
                      setDpWeeklyTaskRef("");
                      setDpCompletionDay("MONDAY");
                      setDailyPlanModal(true);
                    }}
                  >
                    Add Daily Plan
                  </Button>
                </div>
                {weeklyPlans.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Create A Weekly Plan To Start Adding Daily Tasks.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {weeklyPlans.map((w: any) => (
                      <div key={w.id} className="space-y-4">
                        <h5 className="text-xs font-bold text-gray-500 tracking-widest px-2 border-b border-gray-100 pb-1">
                          Week {w.week_number ?? w.weekNumber ?? "?"}:{" "}
                          {w.title || "Plans"}
                        </h5>
                        {okrAsArray(w.tasks).length === 0 ? (
                          <p className="text-xs text-gray-400 italic px-4">
                            No Tasks For This Week.
                          </p>
                        ) : (
                          <div className="space-y-4 pl-4">
                            {okrAsArray(w.tasks).map((task: any) => {
                              const dps = okrAsArray(task.dailyPlans);
                              return (
                                <div key={task.id} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-primary">
                                      Task: {task.title}
                                    </p>
                                    <span className="text-[10px] text-gray-400">
                                      {task.current_value} / {task.target_value}
                                    </span>
                                  </div>
                                  <ul className="space-y-2">
                                    {dps.map((m: any) => (
                                      <li
                                        key={m.id}
                                        className="flex items-center justify-between bg-white border border-gray-100 p-3 rounded-xl shadow-sm"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <p className="text-sm font-medium text-gray-800 truncate">
                                              {m.title}
                                            </p>
                                            {m.is_direct === false && (
                                              <span className="text-[9px] font-bold bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                Indirect
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-4 mt-1">
                                            {m.description && (
                                              <p className="text-xs text-gray-500 truncate">
                                                {m.description}
                                              </p>
                                            )}
                                            <ProgressBar
                                              percent={
                                                m.target_value > 0
                                                  ? Number(
                                                    (
                                                      (Number(
                                                        m.current_value || 0,
                                                      ) /
                                                        Number(
                                                          m.target_value,
                                                        )) *
                                                      100
                                                    ).toFixed(2),
                                                  )
                                                  : Number(
                                                    m.progress_percent || 0,
                                                  )
                                              }
                                              className="w-24"
                                            />
                                            <span className="text-[10px] font-medium text-k-medium-grey tabular-nums shrink-0">
                                              {m.current_value ?? 0} /{" "}
                                              {m.target_value ?? 0}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={MdTrendingUp}
                                            onClick={() =>
                                              openDailyProgressModal(
                                                Number(w.employee_kr_id),
                                                Number(w.week_number),
                                                Number(
                                                  w.employee_month_plan_id || 1,
                                                ),
                                                Number(m.id),
                                                Number(m.current_value || 0),
                                                Number(
                                                  m.target_value ??
                                                  task.target_value ??
                                                  0,
                                                ),
                                                task.title || "",
                                                m.title || "",
                                                m.completion_day || "N/A",
                                              )
                                            }
                                          >
                                            Update Progress
                                          </Button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === "subtasks" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {!isExecutionEnabled && (
                    <p className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                      <MdWarningAmber className="text-base text-amber-600 shrink-0" />
                      Subtasks Can Only Be Added To Approved Or Published KRs.
                    </p>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    icon={MdAdd}
                    disabled={!selectedKrId || !isExecutionEnabled}
                    onClick={() => {
                      setSubTitle("");
                      setSubDesc("");
                      setSubMonth(1);
                      setSubWeek(1);
                      setSubOpen(true);
                    }}
                  >
                    Add Subtask
                  </Button>
                </div>
                {subOpen && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 text-sm shadow-sm">
                    <input
                      placeholder="Title"
                      value={subTitle}
                      onChange={(e) => setSubTitle(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-k-dark-grey placeholder:text-k-medium-grey focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    />
                    <BulletTextarea
                      placeholder="Description"
                      value={subDesc}
                      onValueChange={setSubDesc}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-k-dark-grey placeholder:text-k-medium-grey focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors min-h-[72px]"
                    />
                    <div className="flex flex-wrap gap-3 items-end">
                      <label className="text-xs text-k-medium-grey font-medium flex flex-col gap-1">
                        Target KR
                        <select
                          value={selectedKrId || ""}
                          onChange={(e) =>
                            setSelectedKrId(Number(e.target.value))
                          }
                          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-k-dark-grey focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors cursor-pointer min-w-[160px]"
                        >
                          {krs.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-k-medium-grey font-medium flex flex-col gap-1">
                        Target Month
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={subMonth}
                          onChange={(e) =>
                            setSubMonth(Number(e.target.value) || 1)
                          }
                          className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-k-dark-grey focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                        />
                      </label>
                      <label className="text-xs text-k-medium-grey font-medium flex flex-col gap-1">
                        Target Week
                        <input
                          type="number"
                          min={1}
                          max={53}
                          value={subWeek}
                          onChange={(e) =>
                            setSubWeek(Number(e.target.value) || 1)
                          }
                          className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-k-dark-grey focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleCreateSubtask()}
                      >
                        Save Subtask
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSubOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {tabLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : subtasks.length === 0 ? (
                  <p className="text-sm text-gray-500">No Subtasks Yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {subtasks.map((s: any) => (
                      <li
                        key={s.id}
                        className="rounded-xl border border-gray-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                      >
                        <div>
                          <p className="font-medium text-gray-800">{s.title}</p>
                          {s.description ? (
                            <BulletText
                              text={s.description}
                              className="text-gray-600 text-xs mt-1"
                            />
                          ) : null}
                          <p className="text-gray-500 text-xs mt-1">
                            M{s.target_month ?? "?"} W{s.target_week ?? "?"}
                          </p>
                        </div>
                        <select
                          value={s.status_code ?? "todo"}
                          onChange={(e) =>
                            void handleSubtaskStatus(
                              Number(s.id),
                              e.target.value,
                            )
                          }
                          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-k-dark-grey focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors cursor-pointer"
                        >
                          {SUBTASK_STATUSES.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === "updates" && (
              <div>
                {tabLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : progressHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No Progress History Yet.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {progressHistory.map((u: any, i: number) => (
                      <li
                        key={u.id ?? i}
                        className="rounded-xl border border-gray-100 px-4 py-3"
                      >
                        <span className="text-xs text-gray-500">
                          Week {u.week_number ?? "?"} · Month{" "}
                          {u.month_number ?? "?"}
                        </span>
                        <p className="text-gray-800 mt-1">
                          Value: {u.current_value ?? u.value ?? "—"} ·{" "}
                          {u.confidence_level ?? ""}
                        </p>
                        {u.comment ? (
                          <p className="text-gray-600 text-xs mt-1">
                            {u.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={MdArrowBack}
            onClick={() => navigate(routeConstants.okrMyExecution)}
            className="mt-4"
          >
            Back to My Execution
          </Button>
        </ExecutionShell>

        <EmployeeKRModal
          isOpen={krModal}
          onClose={() => setKrModal(false)}
          initialTitle={krTitle}
          initialDescription={krDesc}
          onChangeTitle={setKrTitle}
          onChangeDescription={setKrDesc}
          metricDefinitions={metricDefinitions}
          metricDefinitionId={krMetricId}
          onChangeMetricDefinitionId={handleKrMetricChange}
          targetValue={krTarget}
          onChangeTargetValue={setKrTarget}
          unitOfMeasure={krUnit}
          onChangeUnitOfMeasure={setKrUnit}
          weightPercent={krWeight}
          onChangeWeightPercent={setKrWeight}
          onSubmit={() => void handleSaveKr()}
          isEdit={krEditId != null}
          submitting={submitting}
          onAssignContributor={
            isManager && krEditId
              ? () => openAssignModal(Number(krEditId), krTitle, true)
              : undefined
          }
          teamMembers={
            isManager
              ? (teamMembers || []).map((tm: any) => ({
                id: tm.employee.employee_id || tm.employee.id,
                name: tm.employee.full_name,
              }))
              : undefined
          }
          assignedEmployeeIds={krAssignedEmployeeIds}
          lockedEmployeeIds={krLockedEmployeeIds}
          onChangeAssignedEmployees={setKrAssignedEmployeeIds}
          isDirect={krIsDirect}
          onChangeIsDirect={setKrIsDirect}
          objectiveTitle={objectiveTitle}
        />
        <MonthlyPlanModal
          isOpen={monthModal}
          onClose={() => setMonthModal(false)}
          krOptions={krs
            .filter((k) =>
              ["approved", "published"].includes(
                String(k.status_code ?? "").toLowerCase(),
              ),
            )
            .map((k) => ({
              id: k.id,
              title: k.title,
              targetValue: Number(k.target_value || 0),
            }))}
          monthNumber={mMonthNum}
          description={mDesc}
          onChangeMonthNumber={setMMonthNum}
          onChangeDescription={setMDesc}
          items={mItems}
          onAddItem={() => {
            setMItems((prev) => [
              ...prev,
              {
                id: Date.now().toString() + Math.random(),
                krId: "",
                title: "",
                target: "",
                initial: "",
                metricId: "",
                managerMonthPlanItemId: "",
                isDirect: true,
              },
            ]);
          }}
          onRemoveItem={(id) => {
            setMItems((prev) => prev.filter((it) => it.id !== id));
          }}
          onChangeItem={(id, field, val) => {
            setMItems((prev) =>
              prev.map((it) => (it.id === id ? { ...it, [field]: val } : it)),
            );
          }}
          alignmentOptions={alignmentMonthOptions}
          requireAlignment={!!objective?.chosen_parent_employee_kr_id}
          metrics={metricDefinitions}
          onSubmit={() => void handleCreateMonth()}
          isEdit={mEditId != null}
          submitting={submitting}
        />
        <WeeklyPlanModal
          isOpen={weekModal}
          onClose={() => setWeekModal(false)}
          krOptions={wKrOptions}
          weekNumber={wWeekNum}
          onChangeWeekNumber={setWWeekNum}
          monthPlanOptions={monthPlanOptions}
          employeeMonthPlanId={wMonthPlanId}
          onChangeEmployeeMonthPlanId={setWMonthPlanId}
          title={wTitle}
          onChangeTitle={setWTitle}
          description={wDesc}
          onChangeDescription={setWDesc}
          items={wItems}
          onAddItem={() => {
            setWItems((prev) => [
              ...prev,
              {
                id: Date.now().toString() + Math.random(),
                krId: "",
                metricId: "",
                blockers: "",
                tasks: [],
                managerWeeklyPlanId: "",
                isDirect: true,
              },
            ]);
          }}
          onRemoveItem={(id) => {
            setWItems((prev) => prev.filter((it) => it.id !== id));
          }}
          onChangeItem={(id, field, val) => {
            setWItems((prev) =>
              prev.map((it) => (it.id === id ? { ...it, [field]: val } : it)),
            );
          }}
          metrics={metricDefinitions}
          onSubmit={() => void handleCreateWeek()}
          isEdit={wEditId != null}
          submitting={submitting}
          alignmentOptions={alignmentWeeklyOptions}
          requireAlignment={!!objective?.chosen_parent_employee_kr_id}
        />
        <DailyPlanModal
          isOpen={dailyPlanModal}
          onClose={() => setDailyPlanModal(false)}
          krOptions={dpKrOptions}
          selectedTaskIds={dpSelectedTaskIds}
          onChangeTaskIds={setDpSelectedTaskIds}
          krTargets={dpKrTargets}
          onChangeKrValue={(id, field, val) => {
            setDpKrTargets((prev) => ({
              ...prev,
              [id]: {
                ...(prev[id] || { target: "", initial: "", metricId: "", isDirect: true }),
                [field]: val,
              },
            }));
          }}
          title={dpTitle}
          onChangeTitle={setDpTitle}
          description={dpDesc}
          onChangeDescription={setDpDesc}
          completionDay={dpCompletionDay}
          onChangeCompletionDay={setDpCompletionDay}
          metrics={metricDefinitions}
          weeklyPlanOptions={weeklyPlans}
          onSubmit={() => void handleCreateDailyPlan()}
          isEdit={dpEditId != null}
          submitting={submitting}
        />
        <ProgressUpdateModal
          isOpen={progModal}
          onClose={() => setProgModal(false)}
          metricCategory={
            krs.find((k) => k.id === selectedKrId)?.metricDefinition
              ?.category || "NUMERIC"
          }
          currentValue={progValue}
          onChangeCurrentValue={setProgValue}
          targetValue={progTarget}
          isCompleted={progIsCompleted}
          onChangeIsCompleted={setProgIsCompleted}
          note={note}
          onChangeNote={setNote}
          monthNumber={progMonth}
          weekNumber={progWeek}
          onChangeMonthNumber={setProgMonth}
          onChangeWeekNumber={setProgWeek}
          onSubmit={() => void handleProgress()}
          monthOptions={monthPlans.map((m: any) => ({
            label: `Month ${m.month_number}`,
            value: m.month_number,
          }))}
          weekOptions={weeklyPlans
            .filter((w: any) => w.employee_kr_id === selectedKrId)
            .map((w: any) => ({
              label: `Week ${w.week_number} - ${w.title || "Untitled"}`,
              value: w.week_number,
            }))}
          krOptions={krs.map((k) => ({
            label: k.title,
            value: k.id,
          }))}
          selectedKrId={selectedKrId || undefined}
          onChangeSelectedKrId={handleProgressKrChange}
        />

        <DailyPlanProgressModal
          isOpen={dailyProgModal}
          onClose={() => setDailyProgModal(false)}
          metricCategory={
            krs.find((k) => k.id === selectedKrId)?.metricDefinition
              ?.category || "NUMERIC"
          }
          currentValue={progValue}
          onChangeCurrentValue={setProgValue}
          targetValue={progTarget}
          isCompleted={progIsCompleted}
          onChangeIsCompleted={setProgIsCompleted}
          note={note}
          onChangeNote={setNote}
          onSubmit={() => void handleProgress()}
          taskTitle={dailyProgContext.taskTitle}
          dailyPlanTitle={dailyProgContext.dailyTitle}
          completionDay={dailyProgContext.day}
        />

        <AssignContributorModal
          isOpen={assignModal}
          onClose={() => setAssignModal(false)}
          krTitle={assignTargetTitle}
          employees={(Array.isArray(teamMembers) ? teamMembers : []).map(
            (m: any) => ({
              id: m.employee_id || m.employee?.id || m.id,
              name:
                m.employee?.full_name ||
                `${m.first_name || ""} ${m.last_name || ""}`.trim() ||
                "Unknown Member",
              role: m.jobTitle?.title || m.position_name || "Team Member",
            }),
          )}
          selectedEmployeeId={selectedSubordinateId}
          onSelectEmployee={setSelectedSubordinateId}
          required={isRequiredContributor}
          onToggleRequired={setIsRequiredContributor}
          onSubmit={() => void handleAssignContributor()}
          loading={assignLoading}
        />
      </div>
    </EmployeeLayout>
  );
}
