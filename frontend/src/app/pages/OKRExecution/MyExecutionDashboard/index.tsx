import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import RefreshButton from "../../../components/common/RefreshButton";

import MonthlyPlanTab from "../components/MonthlyPlanTab";
import WeeklyPlanTab from "../components/WeeklyPlanTab";
import DailyPlanTab from "../components/DailyPlanTab";
import EmployeeOverviewTab from "../components/EmployeeOverviewTab";
import EditOkrChangeRequestModal from "../../Admin/OKR/components/modals/EditOkrChangeRequestModal";
import RealignmentBanner from "../../Admin/OKR/components/RealignmentBanner";
import ObjectiveCard from "../../../components/common/ObjectiveCard";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";
import PlanStatusBanner from "../components/PlanStatusBanner";
import { routeConstants } from "../../../../utils/constants";
import { fetchMonthlyAvailableWeight } from "../../../services/okr-execution.api";
import type { AvailableWeight } from "../../../../types/okr.types";
import {
  MdAdd,
  MdEditDocument,
  MdFactCheck,
  MdFileDownload,
  MdFlag,
  MdPublish,
  MdSend,
} from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import ExecutionSetupModal, {
  type EmployeeAdoptionMode,
} from "../components/modals/ExecutionSetupModal";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import {
  fromBackendExecutionMode,
  okrAsArray,
  okrErrorMessage,
  okrListRows,
  okrUnwrap,
  resolveConfidenceLevel,
} from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../slice/authSlice/selectors";
import KeyResultListItem from "../../../components/common/KeyResultListItem";
import TabBar, { Tab } from "../../../components/common/TabBar";
import { formatOkrNumber } from "../../../utils/okrNumber";

type Card = {
  id: string;
  title: string;
  parentKr: string | null;
  progress: number;
  indirectProgress?: number;
  mode: EmployeeAdoptionMode | null;
  status: string;
  krId?: number;
  keyResults?: any[];
  feedbackNote?: string;
  reviewerName?: string;
};

type AssignedKR = {
  contributor_id: number;
  department_kr_id: number | null;
  employee_kr_id: number | null;
  title: string;
  description: string;
  required_target: number | null;
  weight_percent: number | null;
  unit_of_measure: string | null;
};

type LevelRole = "CEO" | "DIRECTOR" | "MANAGER_TEAM_LEADER" | "EMPLOYEE";

type CadenceRuleSet = {
  allow_monthly: boolean;
  allow_weekly: boolean;
  allow_daily: boolean;
};

type LevelConfiguration = Record<LevelRole, CadenceRuleSet>;

// At the top with other types
// Type removed here as it is imported from ExecutionSetupModal

const TABS: Tab[] = [
  { id: "quarterly", label: "Quarterly OKR Plan" },
  { id: "monthly", label: "Monthly Plan" },
  { id: "weekly", label: "Weekly Plan" },
  { id: "daily", label: "Daily Plan" },
];

function keyResultsFromObjectiveRow(o: Record<string, unknown>): unknown[] {
  const raw =
    o.employee_key_results ??
    o.key_results ??
    o.keyResults ??
    o.employeeKeyResults;
  return Array.isArray(raw) ? raw : [];
}

export default function MyExecutionDashboardPage() {
  const navigate = useNavigate();
  const user = useSelector(selectAuthUser);
  type TabId = "quarterly" | "monthly" | "weekly" | "daily";

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as TabId;
    return (
      (["quarterly", "monthly", "weekly", "daily"] as TabId[]).includes(tab)
        ? tab
        : "quarterly"
    ) as TabId;
  });

  // Deep-link target for the Monthly tab section to auto-expand.
  const [monthlyExpandMonth, setMonthlyExpandMonth] = useState<
    1 | 2 | 3 | undefined
  >(() => {
    const params = new URLSearchParams(window.location.search);
    const m = Number(params.get("month"));
    return m === 1 || m === 2 || m === 3 ? (m as 1 | 2 | 3) : undefined;
  });

  // Deep-link target for the Weekly tab section to auto-expand.
  const [weeklyExpandWeek] = useState<number | undefined>(() => {
    const params = new URLSearchParams(window.location.search);
    const w = Number(params.get("week"));
    return w >= 1 && w <= 5 ? w : undefined;
  });

  // Deep-link target for focusing a specific item (Monthly Milestone, Weekly Task, etc.)
  const [focusItemId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("focus");
  });

  // Cross-tab refresh signal: bumped when the Weekly tab creates/deletes a
  // plan so the Monthly tab's weekly-allocation lines refresh on next view.
  const [monthlyRefreshNonce, setMonthlyRefreshNonce] = useState(0);
  const [weeklyRefreshNonce, setWeeklyRefreshNonce] = useState(0);
  const [dailyRefreshNonce, setDailyRefreshNonce] = useState(0);

  // Number of ISO weeks in the current calendar month (4 or 5).
  const weeksInCurrentMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    return Math.ceil((lastDay + firstDow) / 7);
  }, []);

  // Per-KR allocation cache used for the Quarterly tab line + the modal.
  const [krAllocations, setKrAllocations] = useState<
    Record<string, AvailableWeight | null>
  >({});
  const [allocationsLoading, setAllocationsLoading] = useState(false);

  const [cards, setCards] = useState<Card[]>([]);
  const [assignedKrs, setAssignedKrs] = useState<AssignedKR[]>([]);
  const [loading, setLoading] = useState(true);
  const [objectiveLimitMax, setObjectiveLimitMax] = useState<number | null>(
    null,
  );

  const [currentCycleId, setCurrentCycleId] = useState<number | null>(null);
  const [currentCycle, setCurrentCycle] = useState<{
    id?: number;
    start_date?: string;
    end_date?: string;
  } | null>(null);

  // Planning cadence configuration
  const [levelConfig, setLevelConfig] = useState<LevelConfiguration | null>(
    null,
  );

  // Plan Modal States

  // Modal State
  const [setupOpen, setSetupOpen] = useState(false);
  const [modeDraft, setModeDraft] =
    useState<EmployeeAdoptionMode>("direct_adoption");
  const [setupContributorId, setSetupContributorId] = useState<number | null>(
    null,
  );
  const [setupDeptKrId, setSetupDeptKrId] = useState<number | null>(null);
  const [setupEmployeeKrId, setSetupEmployeeKrId] = useState<number | null>(
    null,
  );

  const [setupCustomTitle, setSetupCustomTitle] = useState("");
  const [setupCustomDescription, setSetupCustomDescription] = useState("");
  const [saveSetupBusy, setSaveSetupBusy] = useState(false);
  const [postPublishEditingKr, setPostPublishEditingKr] = useState<any | null>(
    null,
  );
  const [quarterlySubmitLoading, setQuarterlySubmitLoading] = useState(false);
  const [quarterlyPublishLoading, setQuarterlyPublishLoading] = useState(false);
  const [postPublishEditingType, setPostPublishEditingType] = useState<
    "EMPLOYEE_KR" | "EMPLOYEE_MONTH_PLAN" | "WEEKLY_PLAN"
  >("EMPLOYEE_KR");

  // Handle query params for filtering and direct actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const krId = params.get("krId");
    const tab = params.get("tab");

    // Note: Monthly tab deep-link expansion (?month=1|2|3) is wired via
    // monthlyExpandMonth state above. The legacy auto-open modal flow is
    // gone — the new Add Monthly Plan modal lives inside MonthlyPlanTab.

    // TASK 2: ?focus= param handling
    const focusId = params.get("focus");
    if (focusId) {
      // We need to wait for the data to load and components to mount.
      // The actual execution is handled in a separate useEffect below
      // that watches the 'loading' state and 'focusId'.
    }

    void tab;
    void krId;
  }, []);

  // Effect to handle ?focus= param after data is loaded
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get("focus");

    if (focusId && !loading && cards.length > 0) {
      // Give it a small timeout to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        const element =
          document.getElementById(`focus-${focusId}`) ||
          document.getElementById(`EO-${focusId}`) ||
          document.getElementById(focusId);

        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });

          // Apply highlight class
          element.classList.add("focus-highlight-pulse");

          // Remove highlight class after 2s
          setTimeout(() => {
            element.classList.remove("focus-highlight-pulse");
          }, 2000);

          // Clear the ?focus= param from the URL
          const url = new URL(window.location.href);
          url.searchParams.delete("focus");
          window.history.replaceState({}, "", url.toString());
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [loading, cards, activeTab]);

  const currentObjectiveCount = cards.length;
  const remainingObjectivesToAdopt =
    objectiveLimitMax != null
      ? Math.max(0, objectiveLimitMax - currentObjectiveCount)
      : null;
  const objectiveLimitReached =
    objectiveLimitMax != null && remainingObjectivesToAdopt === 0;

  const handleNewObjectiveClick = () => {
    if (objectiveLimitReached) {
      ToastService.error(
        "You have reached the maximum allowed objectives for this cycle.",
      );
      return;
    }

    if (assignedKrs.length === 0) {
      ToastService.error("You don't have any pending assigned KRs to adopt.");
      return;
    }

    // Reset modal state
    setModeDraft("direct_adoption");
    setSetupCustomTitle("");
    setSetupCustomDescription("");

    if (assignedKrs.length > 0) {
      handleSelectAdoptOption(assignedKrs[0].contributor_id);
    } else {
      setSetupContributorId(null);
    }

    setSetupOpen(true);
  };

  const handleSelectAdoptOption = (contributorId: number) => {
    const kr = assignedKrs.find((a) => a.contributor_id === contributorId);
    if (!kr) return;

    setSetupContributorId(kr.contributor_id);
    setSetupDeptKrId(kr.department_kr_id);
    setSetupEmployeeKrId(kr.employee_kr_id);

    // Always start with direct adoption values of the newly selected KR
    setSetupCustomTitle(kr.title);
    setSetupCustomDescription(kr.description);
    setModeDraft("direct_adoption");
  };

  const userId = user?.employee_id
    ? String(user.employee_id)
    : user?.id
      ? String(user.id)
      : null;

  const loadAssignedKRs = useCallback(async () => {
    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });

      const cycle = okrUnwrap(cycleRes) as { id?: number } | null;
      const cid = cycle?.id != null ? Number(cycle.id) : null;
      setCurrentCycle((cycle as any) ?? null);

      if (!cid || !userId) {
        setAssignedKrs([]);
        return;
      }

      // Fetch assigned KRs
      const reqQuery: Record<string, any> = { cycle_id: cid, user_id: userId };
      if (user?.headed_department_id) {
        reqQuery.department_id = String(user.headed_department_id);
      }

      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.employeeAssignedKRs,
        query: reqQuery,
        isSecureRoute: true,
      });
      const rows = okrAsArray(okrUnwrap(res)) as any[];
      const mapped = rows.map((r) => ({
        contributor_id: Number(r.contributor_id || r.id),
        department_kr_id:
          r.company_kr?.id || r.companyKr?.id || r.department_kr?.id || null,
        employee_kr_id: r.employee_kr?.id || r.employeeKr?.id || null,
        title:
          r.company_kr?.title ||
          r.companyKr?.title ||
          r.employee_kr?.title ||
          r.employeeKr?.title ||
          r.department_kr?.title ||
          r.departmentKr?.title ||
          "Assigned KR",
        description:
          r.company_kr?.description ||
          r.companyKr?.description ||
          r.employee_kr?.description ||
          r.employeeKr?.description ||
          r.department_kr?.description ||
          r.departmentKr?.description ||
          "",
        required_target:
          r.required_target != null ? Number(r.required_target) : null,
        weight_percent:
          r.weight_percent != null ? Number(r.weight_percent) : null,
        unit_of_measure:
          r.company_kr?.unit_of_measure ||
          r.companyKr?.unit_of_measure ||
          r.employee_kr?.unit_of_measure ||
          r.department_kr?.unit_of_measure ||
          r.unit_of_measure ||
          null,
      }));

      setAssignedKrs(mapped);
    } catch (e) {
      console.error("Failed to load assigned KRs:", e);
      setAssignedKrs([]);
    } finally {
    }
  }, [userId]);

  const loadObjectiveLimit = useCallback(async () => {
    try {
      const confRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.configurationMenu,
        isSecureRoute: true,
      });
      const menu = okrUnwrap(confRes) as {
        additional_configuration?: {
          allowed_objectives?: { max?: number | string };
        };
        level_configuration?: LevelConfiguration;
      } | null;
      const maxRaw = Number(
        menu?.additional_configuration?.allowed_objectives?.max,
      );
      if (Number.isFinite(maxRaw) && maxRaw > 0) {
        setObjectiveLimitMax(maxRaw);
      } else {
        setObjectiveLimitMax(null);
      }
      // Load level configuration for cadence rules
      if (menu?.level_configuration) {
        setLevelConfig(menu.level_configuration);
      }
    } catch (e) {
      console.warn("Failed to load objective limit configuration", e);
      setObjectiveLimitMax(null);
    }
  }, []);

  const loadObjectives = useCallback(async () => {
    setLoading(true);
    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = okrUnwrap(cycleRes) as { id?: number } | null;
      const cid = cycle?.id != null ? Number(cycle.id) : null;
      setCurrentCycleId(cid);
      if (!cid) {
        setCards([]);
        return;
      }

      const queries: Record<string, string | number>[] = [{ cycle_id: cid }];
      if (user?.employee_id)
        queries.push({ cycle_id: cid, user_id: String(user.employee_id) });
      if (user?.id) queries.push({ cycle_id: cid, user_id: String(user.id) });

      const merged = new Map<string, Record<string, unknown>>();

      for (const q of queries) {
        try {
          const listRes = await makeCall({
            method: "GET",
            route: apiRoutes.okr.employeeObjectives,
            query: q,
            isSecureRoute: true,
          });
          const rows = okrListRows(okrUnwrap(listRes)) as Record<
            string,
            unknown
          >[];
          rows.forEach((r) => {
            if (r?.id != null) merged.set(String(r.id), r);
          });
        } catch (e) {
          console.warn("Failed to load objective list", e);
        }
      }

      const rows = Array.from(merged.values());

      // === CRITICAL PART: Force fetch full detail + progress for every objective ===
      const enriched = await Promise.all(
        rows.map(async (o: Record<string, unknown>) => {
          const objectiveId = String(o.id);
          let fullObj = o;

          try {
            const detRes = await makeCall({
              method: "GET",
              route: apiRoutes.okr.employeeObjectiveById(objectiveId),
              isSecureRoute: true,
            });
            const unwrapped = okrUnwrap(detRes);
            // Handle both { status, data } and direct object returns
            fullObj =
              unwrapped && typeof unwrapped === "object" && "data" in unwrapped
                ? (unwrapped as any).data
                : unwrapped;
          } catch (e) {
            console.warn(`Detail fetch failed for objective ${objectiveId}`, e);
          }

          return fullObj;
        }),
      );

      // Build final cards
      setCards(
        enriched.map((o: Record<string, unknown>) => {
          const krs = keyResultsFromObjectiveRow(o);
          const first = krs[0] as
            | { execution_mode?: string; progress?: number; id?: number }
            | undefined;
          const parentCompanyKr = o.parentCompanyKr as
            | { title?: string }
            | null
            | undefined;
          const parentEmployeeKr = o.parentEmployeeKr as
            | { title?: string }
            | null
            | undefined;

          const keyResults = Array.isArray(o.keyResults) ? o.keyResults : [];

          return {
            id: String(o.id),
            title: (o.title as string) ?? "Employee objective",
            parentKr:
              parentCompanyKr?.title ??
              parentEmployeeKr?.title ??
              (o.parent_kr_title as string | undefined) ??
              null,
            progress: (() => {
              // Try all possible field names for direct progress
              // Prisma Decimal fields come as strings (e.g., "75.50")
              const raw =
                (o as any).final_score ??
                (o as any).progress_percent ??
                (o as any).progress_pct ??
                (o as any).progress ??
                (o as any).progressPercent;

              // Convert to number - handles string (Prisma Decimal) and number
              if (raw != null && raw !== "") {
                const num = parseFloat(String(raw));
                if (!isNaN(num)) {
                  return Math.max(0, Math.min(100, num));
                }
              }

              // Fallback: calculate from target/current
              const tgt = parseFloat(String((o as any).target_value ?? 0));
              const cur = parseFloat(String((o as any).current_value ?? 0));
              if (tgt > 0) {
                return Math.max(
                  0,
                  Math.min(100, Number(((cur / tgt) * 100).toFixed(2))),
                );
              }
              return 0;
            })(),
            indirectProgress: Number(
              (o as any).indirect_score ??
                (o as any).indirect_score_percent ??
                0,
            ),
            mode: fromBackendExecutionMode(
              first?.execution_mode ?? (o.execution_mode as string | undefined),
            ),
            status: String(o.status_code || "draft").toLowerCase(),
            krId: first?.id ? Number(first.id) : undefined,
            keyResults: keyResults,
            comments: o.comments,
            feedbackNote: (o.feedbackNote ||
              o.feedback_note ||
              o.rejection_reason ||
              o.reviewer_note) as string | undefined,
            reviewerName: (o.reviewerName || o.reviewer_name) as
              | string
              | undefined,
          };
        }),
      );
    } catch (e) {
      console.error(e);
      ToastService.error(okrErrorMessage(e));
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [user?.employee_id, user?.id]);

  // Determine user's role level for cadence configuration
  const userRoleLevel = useMemo<LevelRole>(() => {
    // Get role name from user object - role can be string or { name: string }
    const roleName =
      (typeof user?.role === "string" ? user?.role : user?.role?.name) || "";
    const roleNameUpper = roleName.toUpperCase();

    // Also check role_name field
    const altRoleName = (user?.role_name || "").toUpperCase();

    // Check employee data for position/department head info
    const employeeData = (user as any)?.employee;
    const position = (
      employeeData?.position ||
      employeeData?.job_title ||
      ""
    ).toUpperCase();

    // Department head info comes from user level (from backend auth response)
    const isHead = !!(
      (user as any)?.headed_department_id ||
      (user as any)?.is_department_head ||
      (user as any)?.isDepartmentHead
    );

    const isManagerFlag =
      !!(user as any)?.is_manager || !!(user as any)?.isManager;

    // CEO check first (highest priority)
    if (
      roleNameUpper.includes("CEO") ||
      altRoleName.includes("CEO") ||
      position.includes("CEO") ||
      roleNameUpper.includes("CHIEF EXECUTIVE")
    ) {
      return "CEO";
    }

    // DIRECTOR check - must check BEFORE manager since directors might have "MANAGER" in their title
    // Department head IS a director
    if (isHead) {
      return "DIRECTOR";
    }
    if (
      roleNameUpper.includes("DIRECTOR") ||
      altRoleName.includes("DIRECTOR") ||
      position.includes("DIRECTOR")
    ) {
      return "DIRECTOR";
    }

    // MANAGER/TEAM LEAD check - only if not a department head
    if (
      isManagerFlag ||
      roleNameUpper.includes("MANAGER") ||
      altRoleName.includes("MANAGER") ||
      roleNameUpper.includes("TEAM LEAD") ||
      altRoleName.includes("TEAM LEAD") ||
      roleNameUpper.includes("TEAM_LEAD") ||
      altRoleName.includes("TEAM_LEAD") ||
      position.includes("MANAGER") ||
      position.includes("TEAM LEAD")
    ) {
      return "MANAGER_TEAM_LEADER";
    }

    return "EMPLOYEE";
  }, [user]);

  // Compute cadence rules for current user
  const cadenceRules = useMemo<CadenceRuleSet>(() => {
    if (!levelConfig) {
      // Default: allow all if config not loaded
      return { allow_monthly: true, allow_weekly: true, allow_daily: true };
    }
    const rules = levelConfig[userRoleLevel];
    return (
      rules || { allow_monthly: true, allow_weekly: true, allow_daily: true }
    );
  }, [levelConfig, userRoleLevel]);

  // Filter tabs based on cadence rules
  const visibleTabs = useMemo<Tab[]>(() => {
    return TABS.filter((tab) => {
      if (tab.id === "quarterly") return true;
      if (tab.id === "monthly") return cadenceRules.allow_monthly;
      if (tab.id === "weekly") return cadenceRules.allow_weekly;
      if (tab.id === "daily") return cadenceRules.allow_daily;
      return true;
    });
  }, [cadenceRules]);

  // Handle tab switching when current tab becomes hidden due to cadence rules
  useEffect(() => {
    const visibleIds = visibleTabs.map((t) => t.id);
    if (!visibleIds.includes(activeTab)) {
      // Switch to first visible tab
      const nextTab = visibleIds[0] as TabId;
      setActiveTab(nextTab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.pushState({}, "", url.toString());
    }
  }, [visibleTabs, activeTab]);

  // Flatten all KRs across the user's quarterly objectives into a single
  // list usable by the Monthly tab + Add modal.
  const allKrs = useMemo(() => {
    const out: {
      id: string;
      title: string;
      target_value: number;
      current_value: number;
      start_value?: number;
      progress_pct: number;
      unit?: string;
      status_code?: string;
      objective_status_code?: string;
    }[] = [];
    cards.forEach((c) => {
      const objectiveStatus = String(
        (c as any).status_code ?? (c as any).status ?? "draft",
      ).toLowerCase();
      (c.keyResults ?? []).forEach((kr: any) => {
        const tgt = Number(kr.target_value ?? kr.targetValue ?? 0);
        const cur = Number(
          kr.current_value ?? kr.currentValue ?? kr.final_value ?? 0,
        );
        const start = Number(kr.start_value ?? kr.startValue ?? 0);
        const pct = tgt > 0 ? Math.round((cur / tgt) * 10000) / 100 : 0;
        out.push({
          id: String(kr.id),
          title: String(kr.title ?? "Key result"),
          target_value: tgt,
          current_value: cur,
          start_value: start,
          progress_pct: pct,
          unit: kr.unit_of_measure ?? kr.unit,
          status_code: String(
            kr.status_code ?? kr.status ?? "draft",
          ).toLowerCase(),
          objective_status_code: objectiveStatus,
        });
      });
    });
    return out;
  }, [cards]);

  const krIdsString = JSON.stringify(allKrs.map((kr) => kr.id));
  const krIds = useMemo(() => allKrs.map((kr) => kr.id), [krIdsString]);

  const loadAllocations = useCallback(async () => {
    if (allKrs.length === 0) {
      setKrAllocations({});
      return;
    }
    setAllocationsLoading(true);
    try {
      const next: Record<string, AvailableWeight | null> = {};
      await Promise.all(
        allKrs.map(async (kr) => {
          try {
            next[kr.id] = await fetchMonthlyAvailableWeight(kr.id);
          } catch {
            next[kr.id] = null;
          }
        }),
      );
      setKrAllocations(next);
    } finally {
      setAllocationsLoading(false);
    }
  }, [allKrs]);

  // Re-fetch allocations whenever the user's KR list changes or when the
  // user lands on a tab that uses them.
  useEffect(() => {
    if (activeTab === "quarterly" || activeTab === "monthly") {
      void loadAllocations();
    }
  }, [activeTab, loadAllocations]);

  useEffect(() => {
    void loadObjectives();
    void loadAssignedKRs();
    void loadObjectiveLimit();
  }, [loadObjectives, loadAssignedKRs, loadObjectiveLimit]);

  // Removed openAdoptModal in favor of handleNewObjectiveClick + handleSelectAdoptOption

  const handleAdopt = async () => {
    if ((!setupDeptKrId && !setupEmployeeKrId) || !setupContributorId) return;
    if (modeDraft === "custom_adoption" && !setupCustomTitle.trim()) {
      ToastService.error(
        "Custom adoption requires a title for your key result.",
      );
      return;
    }

    if (modeDraft === "custom_adoption" && !setupCustomTitle.trim()) {
      ToastService.error("Custom adoption requires a title.");
      return;
    }

    setSaveSetupBusy(true);

    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = okrUnwrap(cycleRes) as { id?: number } | null;
      const cid = cycle?.id != null ? Number(cycle.id) : null;
      if (!cid) throw new Error("No active cycle found");

      // FIXED: Use exact values the backend expects
      const backendExecutionMode =
        modeDraft === "custom_adoption" ? "CUSTOMIZED" : "DIRECT_ADOPTION";

      await makeCall({
        method: "POST",
        route: apiRoutes.okr.employeeAdoptAssignedKR,
        body: {
          contributor_id: setupContributorId,
          department_kr_id: setupDeptKrId || undefined,
          employee_kr_id: setupEmployeeKrId || undefined,
          cycle_id: cid,
          execution_mode: backendExecutionMode, // ← This was the issue
          title: modeDraft === "custom_adoption" ? setupCustomTitle.trim() : "",
          description:
            modeDraft === "custom_adoption"
              ? setupCustomDescription.trim()
              : "",
        },
        isSecureRoute: true,
      });

      ToastService.success("Key Result successfully adopted!");
      setSetupOpen(false);

      // Refresh lists
      await Promise.all([loadAssignedKRs(), loadObjectives()]);
    } catch (e: any) {
      ToastService.error(okrErrorMessage(e) || "Failed to adopt Key Result");
    } finally {
      setSaveSetupBusy(false);
    }
  };

  // Legacy openMonthlyModal removed; new MonthlyPlanTab owns its own modal.

  const handleSubmitAllDrafts = async () => {
    let type: "QUARTERLY_PLANNING" | "MONTHLY_PLAN" | "WEEKLY_PLAN";
    let label = "";

    if (activeTab === "quarterly") {
      type = "QUARTERLY_PLANNING";
      label = "Quarterly plan";
    } else if (activeTab === "monthly") {
      type = "MONTHLY_PLAN";
      label = "Monthly milestones";
    } else if (activeTab === "weekly") {
      type = "WEEKLY_PLAN";
      label = "Weekly plans";
    } else {
      return;
    }

    try {
      setLoading(true);
      // Get the current cycle
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = okrUnwrap(cycleRes) as { id?: number } | null;
      const cid = cycle?.id != null ? Number(cycle.id) : null;
      if (!cid) {
        ToastService.error("No active cycle found.");
        return;
      }

      // Submit entire plan for approval
      const result = await makeCall({
        method: "POST",
        route: apiRoutes.okr.submitPlan,
        body: {
          cycle_id: cid,
          type: type,
        },
        isSecureRoute: true,
      });

      const data = okrUnwrap(result) as any;
      const reviewerName = data?.reviewer_name;

      ToastService.success(
        `${label} submitted successfully.${reviewerName ? ` Sent to ${reviewerName} for review.` : ""}`,
      );

      // Refresh relevant data
      if (activeTab === "quarterly") void loadObjectives();
      else if (activeTab === "weekly") void loadAllocations();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const quarterlyBannerMeta = useMemo(() => {
    if (activeTab !== "quarterly" || cards.length === 0) return null;

    const statuses = cards.map((c) => c.status.toUpperCase());
    let bannerStatus: any = "DRAFT";

    if (statuses.includes("REJECTED")) bannerStatus = "REJECTED";
    else if (
      statuses.includes("SUBMITTED") ||
      statuses.includes("UNDER_REVIEW")
    )
      bannerStatus = "SUBMITTED";
    else if (statuses.includes("APPROVED")) bannerStatus = "APPROVED";
    else if (
      statuses.every((s) => ["PUBLISHED", "ON_TRACK", "COMPLETED"].includes(s))
    )
      bannerStatus = "PUBLISHED";
    else if (
      statuses.some((s) => ["PUBLISHED", "ON_TRACK", "COMPLETED"].includes(s))
    )
      bannerStatus = "PUBLISHED";

    const feedbackItems: any[] = [];
    cards.forEach((c: any) => {
      // 1. Add structured historical comments from Objective
      if (Array.isArray(c.comments)) {
        c.comments.forEach((comm: any) => {
          feedbackItems.push({
            status: (c.status || "DRAFT").toUpperCase(),
            reviewerName: comm.authorName || comm.author_name || "Reviewer",
            feedbackNote: comm.content,
            targetTitle: c.title,
            timestamp: comm.created_at,
          });
        });
      }

      // 1b. Add structured historical comments from Key Results
      if (Array.isArray(c.keyResults)) {
        c.keyResults.forEach((kr: any) => {
          if (Array.isArray(kr.comments)) {
            kr.comments.forEach((comm: any) => {
              feedbackItems.push({
                status: (kr.status_code || "DRAFT").toUpperCase(),
                reviewerName: comm.authorName || comm.author_name || "Reviewer",
                feedbackNote: comm.content,
                targetTitle: kr.title,
                timestamp: comm.created_at,
              });
            });
          }
        });
      }

      // 2. Backward compatibility: Add legacy rejection_note if not already represented
      if (c.feedbackNote || c.rejection_note) {
        const note = c.feedbackNote || c.rejection_note;
        const isDuplicate = feedbackItems.some(
          (f) => f.targetTitle === c.title && f.feedbackNote === note,
        );
        if (!isDuplicate) {
          feedbackItems.push({
            status: (c.status || "DRAFT").toUpperCase(),
            reviewerName: c.reviewerName || c.reviewer_name || "Reviewer",
            feedbackNote: note,
            targetTitle: c.title,
            timestamp: c.approved_at || c.submitted_at,
          });
        }
      }
    });

    // Sort feedback by most recent first
    feedbackItems.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      return 0;
    });

    return {
      bannerStatus,
      feedbackItems,
      isSubmitted: bannerStatus !== "DRAFT",
    };
  }, [activeTab, cards]);

  const goDetail = (id: string) => {
    navigate(
      routeConstants.okrEmployeeObjectiveDetail.replace(":objectiveId", id),
    );
  };

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-linear-to-b from-slate-50 to-white -mx-4 md:-mx-8 px-4 md:px-8">
        <RealignmentBanner />
        <ExecutionShell
          breadcrumbs={[{ label: "Execution" }, { label: "My Execution" }]}
          title="My Execution Dashboard"
          subtitle="Manage your objectives, plans and track your daily progress."
          icon={<MdFactCheck className="text-3xl" />}
          actions={
            <div className="flex gap-3">
              {activeTab !== "daily" && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={MdSend}
                  onClick={handleSubmitAllDrafts}
                  loading={loading}
                  className="shadow-lg shadow-secondary/20"
                >
                  Submit Planning
                </Button>
              )}
              <RefreshButton
                onClick={() => {
                  void loadObjectives();
                  void loadAssignedKRs();
                  void loadObjectiveLimit();
                  void loadAllocations();
                  setMonthlyRefreshNonce((n) => n + 1);
                  setWeeklyRefreshNonce((n) => n + 1);
                  setDailyRefreshNonce((n) => n + 1);
                }}
                loading={loading}
              />
              {activeTab === "quarterly" && (
                <Button
                  variant="white"
                  size="sm"
                  icon={MdFileDownload}
                  onClick={() => navigate(routeConstants.okrImportExport)}
                  className="shadow-xs"
                >
                  Import / Export
                </Button>
              )}
              {activeTab === "quarterly" && (
                <Button
                  variant="white"
                  size="sm"
                  icon={MdAdd}
                  onClick={handleNewObjectiveClick}
                  disabled={objectiveLimitReached}
                >
                  {assignedKrs.length > 0
                    ? `New Objective (${assignedKrs.length} Pending KRs)`
                    : "New Objective"}
                </Button>
              )}
            </div>
          }
        >
          {/* TABS NAVIGATION */}
          <div className="mb-6">
            <TabBar
              tabs={visibleTabs}
              activeTab={activeTab}
              onChange={(id) => {
                const next = id as TabId;
                setActiveTab(next);

                if (next === "quarterly" || next === "monthly") {
                  void loadObjectives();
                }
                if (next === "quarterly" || next === "monthly") {
                  void loadAllocations();
                }

                const url = new URL(window.location.href);
                url.searchParams.set("tab", next);
                if (next !== "monthly") {
                  url.searchParams.delete("month");
                  setMonthlyExpandMonth(undefined);
                }
                window.history.pushState({}, "", url.toString());
              }}
            />
          </div>

          {activeTab === "quarterly" && (
            <div className="space-y-6">
              {currentCycleId && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-700">
                  <EmployeeOverviewTab cycleId={currentCycleId} />
                </div>
              )}

              {/* MY OBJECTIVES SECTION */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                        <MdFlag size={24} />
                      </div>
                      My Objectives
                    </h3>
                    <p className="text-slate-400 text-sm mt-1 font-medium ml-13 hidden sm:block">
                      Track and manage your quarterly strategic goals and key
                      results.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {cards.some((c) =>
                      ["draft", "rejected"].includes(c.status),
                    ) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={MdSend}
                        loading={quarterlySubmitLoading}
                        onClick={async () => {
                          setQuarterlySubmitLoading(true);
                          try {
                            const cycleRes = await makeCall({
                              method: "GET",
                              route: apiRoutes.okr.currentCycle,
                              isSecureRoute: true,
                            });
                            const cycle = okrUnwrap(cycleRes) as {
                              id?: number;
                            } | null;
                            const cid =
                              cycle?.id != null ? Number(cycle.id) : null;
                            if (!cid) {
                              ToastService.error("No active cycle found.");
                              return;
                            }

                            const result = await makeCall({
                              method: "POST",
                              route: apiRoutes.okr.submitPlan,
                              body: {
                                cycle_id: cid,
                                type: "QUARTERLY_PLANNING",
                              },
                              isSecureRoute: true,
                            });

                            const data = okrUnwrap(result) as any;
                            const reviewerName = data?.reviewer_name;

                            ToastService.success(
                              `Quarterly plan submitted successfully.${reviewerName ? ` Sent to ${reviewerName} for review.` : ""}`,
                            );
                            loadObjectives();
                          } catch (e) {
                            ToastService.error(okrErrorMessage(e));
                          } finally {
                            setQuarterlySubmitLoading(false);
                          }
                        }}
                      >
                        Submit for Review
                      </Button>
                    )}
                    {cards.some((c) => c.status === "approved") && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={MdPublish}
                        loading={quarterlyPublishLoading}
                        onClick={async () => {
                          setQuarterlyPublishLoading(true);
                          try {
                            const approvedIds = cards
                              .filter((c) => c.status === "approved")
                              .map((c) => Number(c.id));

                            await makeCall({
                              method: "PATCH",
                              route: apiRoutes.okr.employeeBulkPublish,
                              isSecureRoute: true,
                              body: { objective_ids: approvedIds, kr_ids: [] },
                            });
                            ToastService.success(
                              "Approved objectives published successfully.",
                            );
                            loadObjectives();
                          } catch (e) {
                            ToastService.error("Failed to publish objectives.");
                          } finally {
                            setQuarterlyPublishLoading(false);
                          }
                        }}
                      >
                        Publish Approved
                      </Button>
                    )}
                  </div>
                </div>

                {quarterlyBannerMeta &&
                  (quarterlyBannerMeta.isSubmitted ||
                    quarterlyBannerMeta.feedbackItems.length > 0) && (
                    <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                      <PlanStatusBanner
                        plan_status={quarterlyBannerMeta.bannerStatus}
                        feedbackItems={quarterlyBannerMeta.feedbackItems}
                        hideStatusBanner={
                          quarterlyBannerMeta.bannerStatus === "PUBLISHED"
                        }
                      />
                    </div>
                  )}

                {loading ? (
                  <div className="flex flex-col gap-6">
                    <LoadingSkeleton variant="card" count={3} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {cards.map((c) => (
                      <ObjectiveCard
                        key={c.id}
                        id={`EO-${c.id}`}
                        title={c.title}
                        status={c.status}
                        progress={c.progress}
                        indirectProgress={c.indirectProgress}
                        feedbackNote={c.feedbackNote}
                        reviewerName={c.reviewerName}
                        krCount={c.keyResults?.length}
                        expandable={c.keyResults && c.keyResults.length > 0}
                        onClick={() => goDetail(c.id)}
                        parentKrTitle={c.parentKr || undefined}
                        confidenceLevel={resolveConfidenceLevel(c.progress)}
                        actions={
                          <div className="flex flex-wrap items-center gap-2 justify-end flex-1">
                            <Button
                              variant="subtle"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                goDetail(c.id);
                              }}
                            >
                              View Details
                            </Button>
                            <Button
                              variant="white"
                              size="sm"
                              className="text-emerald-700 bg-emerald-50 border-emerald-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  routeConstants.okrEmployeeObjectiveDetail.replace(
                                    ":objectiveId",
                                    String(c.id),
                                  ) + "?createKR=true",
                                );
                              }}
                            >
                              + Add Key Result
                            </Button>
                          </div>
                        }
                      >
                        {c.keyResults && c.keyResults.length > 0 && (
                          <div className="flex flex-col gap-4 mt-2">
                            {c.keyResults.map((kr: any, idx: number) => {
                              const krTgt = Number(
                                kr.target_value ?? kr.targetValue ?? 0,
                              );
                              const krCur = Number(
                                kr.current_value ??
                                  kr.currentValue ??
                                  kr.final_value ??
                                  0,
                              );
                              const directRaw =
                                kr.final_score ??
                                kr.progress_percent ??
                                kr.progress_pct ??
                                kr.progress;
                              const krPct =
                                directRaw != null
                                  ? Number(directRaw)
                                  : krTgt > 0
                                    ? Number(((krCur / krTgt) * 100).toFixed(2))
                                    : 0;
                              const krIndirectPct = Number(
                                kr.indirect_score ??
                                  kr.indirect_score_percent ??
                                  0,
                              );
                              const aw = krAllocations[String(kr.id)];
                              const allocated = aw?.allocated_pct ?? 0;
                              const remaining = aw?.remaining_pct ?? 0;
                              return (
                                <div
                                  key={kr.id}
                                  className="flex flex-col gap-2"
                                >
                                  <KeyResultListItem
                                    title={kr.title}
                                    index={idx}
                                    progress={krPct}
                                    indirectProgress={krIndirectPct}
                                    status={kr.status_code || "draft"}
                                    targetString={`${formatOkrNumber(krCur)} / ${formatOkrNumber(krTgt)}${kr.unit_of_measure ? (kr.unit_of_measure === "%" ? "%" : ` ${kr.unit_of_measure}`) : ""}`}
                                    metricTypeString={`Weight: ${Math.round(kr.weight_percent ?? 0)}%`}
                                    actions={
                                      kr.status_code === "published" && (
                                        <Button
                                          variant="white"
                                          size="sm"
                                          icon={MdEditDocument}
                                          onClick={() => {
                                            setPostPublishEditingType(
                                              "EMPLOYEE_KR",
                                            );
                                            setPostPublishEditingKr(kr);
                                          }}
                                          className="h-7! px-3! text-[10px]! font-black uppercase tracking-widest text-primary border border-primary/20 hover:bg-primary/5 hover:border-primary/40 shadow-sm transition-all duration-300"
                                        >
                                          Edit Published
                                        </Button>
                                      )
                                    }
                                  />
                                  <div className="ml-1 text-[11px] text-slate-500 flex items-center gap-3">
                                    <span className="font-black tracking-widest uppercase text-[10px] text-slate-400">
                                      Monthly allocation:
                                    </span>
                                    {allocationsLoading && !aw ? (
                                      <span className="text-slate-400">
                                        Loading…
                                      </span>
                                    ) : !aw ? (
                                      <span className="text-rose-500">
                                        Allocation unavailable
                                      </span>
                                    ) : (
                                      <>
                                        <span className="tabular-nums">
                                          <strong className="text-slate-700">
                                            {allocated}%
                                          </strong>{" "}
                                          planned
                                        </span>
                                        <span className="text-slate-300">
                                          ·
                                        </span>
                                        <span className="tabular-nums">
                                          <strong className="text-emerald-700">
                                            {remaining}%
                                          </strong>{" "}
                                          remaining
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ObjectiveCard>
                    ))}
                  </div>
                )}

                {!loading && cards.length === 0 && (
                  <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/30 px-8 py-20 text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-black/3 border border-slate-100">
                      <MdFlag className="text-4xl text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">
                      No Active Objectives
                    </h3>
                    <p className="text-slate-400 text-sm max-w-sm mb-8 font-medium">
                      Your execution dashboard is empty. Adopt an assigned Key
                      Result to start planning your progress.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "monthly" && (
            <MonthlyPlanTab
              krs={allKrs}
              cycleId={currentCycleId}
              cycleStartDate={currentCycle?.start_date ?? null}
              cycleEndDate={currentCycle?.end_date ?? null}
              krAllocations={krAllocations}
              initialExpandMonth={monthlyExpandMonth}
              focusItemId={focusItemId ?? undefined}
              refreshNonce={monthlyRefreshNonce}
              allowAdd={cadenceRules.allow_monthly}
              userRoleLevel={userRoleLevel}
              levelConfig={levelConfig}
              onAllocationsChanged={() => {
                void loadAllocations();
                setWeeklyRefreshNonce((n) => n + 1);
              }}
              onPostPublishEdit={(p) => {
                setPostPublishEditingType("EMPLOYEE_MONTH_PLAN");
                setPostPublishEditingKr(p);
              }}
              allowUpdateProgress={
                cadenceRules.allow_monthly &&
                !cadenceRules.allow_weekly &&
                !cadenceRules.allow_daily
              }
            />
          )}

          {activeTab === "weekly" && (
            <WeeklyPlanTab
              krIds={krIds}
              weeksInMonth={weeksInCurrentMonth}
              initialExpandWeek={weeklyExpandWeek}
              refreshNonce={weeklyRefreshNonce}
              allowAdd={cadenceRules.allow_weekly}
              cycleId={currentCycleId}
              cycleStartDate={currentCycle?.start_date ?? null}
              cycleEndDate={currentCycle?.end_date ?? null}
              userRoleLevel={userRoleLevel}
              levelConfig={levelConfig}
              onAllocationsChanged={() => {
                void loadAllocations();
                setMonthlyRefreshNonce((n) => n + 1);
              }}
              onPostPublishEdit={(p) => {
                setPostPublishEditingType("WEEKLY_PLAN");
                setPostPublishEditingKr(p);
              }}
              allowUpdateProgress={
                cadenceRules.allow_weekly && !cadenceRules.allow_daily
              }
            />
          )}

          {activeTab === "daily" && (
            <DailyPlanTab
              krIds={krIds}
              refreshNonce={dailyRefreshNonce}
              allowAdd={cadenceRules.allow_daily}
              cycleStartDate={currentCycle?.start_date ?? null}
              cycleEndDate={currentCycle?.end_date ?? null}
              onProgressUpdated={() => {
                // Bump weekly and monthly nonces so those tabs
                // reload data reflecting the new rollup values
                setWeeklyRefreshNonce((n) => n + 1);
                setMonthlyRefreshNonce((n) => n + 1);
              }}
            />
          )}
        </ExecutionShell>

        <ExecutionSetupModal
          isOpen={setupOpen}
          onClose={() => setSetupOpen(false)}
          options={assignedKrs.map((akr) => ({
            id: akr.contributor_id,
            title: akr.title,
            description: akr.description,
            requiredTarget: akr.required_target,
            weightPercent: akr.weight_percent,
            unitOfMeasure: akr.unit_of_measure,
          }))}
          selectedId={setupContributorId}
          onSelectId={handleSelectAdoptOption}
          mode={modeDraft}
          onChangeMode={setModeDraft}
          customTitle={setupCustomTitle}
          customDescription={setupCustomDescription}
          onChangeCustomTitle={setSetupCustomTitle}
          onChangeCustomDescription={setSetupCustomDescription}
          onConfirm={() => void handleAdopt()}
          saving={saveSetupBusy}
        />

        <EditOkrChangeRequestModal
          isOpen={!!postPublishEditingKr}
          entity={postPublishEditingKr}
          entityType={postPublishEditingType}
          companyId={
            user?.company_id || Number(localStorage.getItem("companyId") || 1)
          }
          cycleId={currentCycleId || 0}
          onClose={() => setPostPublishEditingKr(null)}
          onSuccess={() => {
            setPostPublishEditingKr(null);
            void loadObjectives();
          }}
        />
      </div>
    </EmployeeLayout>
  );
}
