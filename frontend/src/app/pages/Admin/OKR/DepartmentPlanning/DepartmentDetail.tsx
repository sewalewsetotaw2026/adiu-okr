import { useEffect, useMemo, useState } from "react";
import {
  okrAsArray,
  okrUnwrap,
  okrErrorMessage,
} from "../../../../utils/okrApi";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import BulletText from "../../../../components/common/BulletText";
import BulletTextarea from "../../../../components/common/BulletTextarea";

import MetricStat from "../components/MetricStat";
import ModalLayout from "../components/ModalLayout";
import ApprovalFooter from "../components/ApprovalFooter";
import StatusBadge from "../components/StatusBadge";
import ObjectiveCard from "../../../../components/common/ObjectiveCard";
import KeyResultListItem from "../../../../components/common/KeyResultListItem";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../../slice/authSlice/selectors";
import EmployeeLayout from "../../../../components/DefaultLayout/EmployeeLayout";
import { routeConstants } from "../../../../../utils/constants";

import {
  MdAccountTree,
  MdAdd,
  MdChevronRight,
  MdCalendarMonth,
  MdDateRange,
  MdToday,
  MdDeleteOutline,
  MdEdit,
  MdPublish,
  MdTrackChanges,
} from "react-icons/md";

import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import ToastService from "../../../../../utils/ToastService";

/* ================= TYPES ================= */

type DepartmentObjective = {
  id: number;
  title: string;
  description: string;
  progress?: number;
  company_kr_id: number;
  status?: string;
  parentMetricDefinitionId?: number;
  parentMetricName?: string;
  parentUnitOfMeasure?: string;
};

type DepartmentKR = {
  id: number;
  departmentObjectiveId: number;
  title: string;
  description: string;
  status?: string;
  metricDefinitionId?: number;
  unitOfMeasure?: string;
  targetValue?: number;
  weightPercent?: number;

  progress?: number;
  currentValue?: number;

  backendDepartmentKrId?: number;
  /** Rejection / changes-requested comment from the latest approval log */
  rejectionComment?: string | null;
  assignedEmployeeIds?: string[];
};

type TeamMember = {
  employee: {
    id: string;
    full_name: string;
    profile_picture_url?: string;
  };
  department: { name: string };
  jobTitle: { title: string; level?: string };
};

type MonthlyPlanItem = {
  id: number;
  departmentObjectiveId: number;

  departmentKrId: number | null;

  month_number: number;
  title: string;
  description: string;
  progress: number;

  backendMonthPlanId?: number;

  backendDepartmentKrId?: number;
};

type WeeklyPlanItem = {
  id: number;
  monthlyItemId: number;

  week_number: number;
  title: string;
  description: string;
  progress: number;
  backendWeeklyPlanId?: number;

  backendDepartmentKrId?: number;
};

type DailyPlan = {
  id: number;
  weeklyItemId: number;
  title: string;
  done: boolean;
};

type PlanModalContext =
  | { kind: "monthly"; item: MonthlyPlanItem | null }
  | { kind: "weekly"; item: WeeklyPlanItem | null }
  | { kind: "daily"; item: DailyPlan | null }
  | {
      kind: "department_kr";
      item: DepartmentKR | null;
      objectiveId: number;
    };

type StoredExecutionPlan = {
  monthly: MonthlyPlanItem[];
  weekly: WeeklyPlanItem[];
  daily: DailyPlan[];
  departmentKrs: DepartmentKR[];
};

type CompanyKrOption = {
  id: number;
  title: string;
  description?: string;
  objectiveTitle: string;
  objectiveId: number;
};

type ObjectiveExecutionMode = "DIRECT_ADOPTION" | "CUSTOMIZED";

type MetricDefinitionOption = {
  id: number;
  name: string;
  unit_of_measure?: string;
};

const EXECUTION_STORAGE_PREFIX = "okr-dept-execution";

function storageKey(departmentId: string) {
  return `${EXECUTION_STORAGE_PREFIX}:${departmentId}`;
}

function loadStoredPlan(departmentId: string): StoredExecutionPlan {
  try {
    const raw = localStorage.getItem(storageKey(departmentId));
    if (!raw) return { monthly: [], weekly: [], daily: [], departmentKrs: [] };
    const parsed = JSON.parse(raw) as StoredExecutionPlan;
    const monthly = Array.isArray(parsed.monthly) ? parsed.monthly : [];
    return {
      monthly: monthly.map((m: MonthlyPlanItem) => {
        let departmentKrId =
          m.departmentKrId === undefined ? null : m.departmentKrId;
        const month_number =
          typeof m.month_number === "number" && Number.isFinite(m.month_number)
            ? Math.min(3, Math.max(1, Math.floor(m.month_number)))
            : 1;
        const legacy = m as MonthlyPlanItem & { mode?: string };
        const { mode: _dropMode, ...rest } = legacy;
        return { ...rest, departmentKrId, month_number };
      }),
      weekly: Array.isArray(parsed.weekly)
        ? parsed.weekly.map((w: WeeklyPlanItem) => ({
            ...w,
            week_number:
              typeof w.week_number === "number" &&
              Number.isFinite(w.week_number)
                ? Math.min(53, Math.max(1, Math.floor(w.week_number)))
                : 1,
          }))
        : [],
      daily: Array.isArray(parsed.daily) ? parsed.daily : [],
      departmentKrs: Array.isArray(parsed.departmentKrs)
        ? parsed.departmentKrs
        : [],
    };
  } catch {
    return { monthly: [], weekly: [], daily: [], departmentKrs: [] };
  }
}

function persistPlan(departmentId: string, plan: StoredExecutionPlan) {
  localStorage.setItem(storageKey(departmentId), JSON.stringify(plan));
}

/** Append server month plans not already represented locally (by backendMonthPlanId). */
function mergeRemoteMonthlyPlans(
  prev: MonthlyPlanItem[],
  remote: MonthlyPlanItem[],
): MonthlyPlanItem[] {
  const existing = new Set(
    prev
      .map((p) => p.backendMonthPlanId)
      .filter((id): id is number => id != null && Number.isFinite(id)),
  );
  const toAdd = remote.filter(
    (r) => r.backendMonthPlanId != null && !existing.has(r.backendMonthPlanId),
  );
  if (toAdd.length === 0) return prev;
  return [...prev, ...toAdd];
}

function mergeRemoteWeeklyPlans(
  prev: WeeklyPlanItem[],
  remote: WeeklyPlanItem[],
): WeeklyPlanItem[] {
  const existing = new Set(
    prev
      .map((p) => p.backendWeeklyPlanId)
      .filter((id): id is number => id != null && Number.isFinite(id)),
  );
  const toAdd = remote.filter(
    (r) =>
      r.backendWeeklyPlanId != null && !existing.has(r.backendWeeklyPlanId),
  );
  if (toAdd.length === 0) return prev;
  return [...prev, ...toAdd];
}

function mergeRemoteDepartmentKrs(
  prev: DepartmentKR[],
  remote: DepartmentKR[],
): DepartmentKR[] {
  if (remote.length === 0) return prev;

  const byBackendId = new Map<number, DepartmentKR>();
  const byLocalId = new Map<number, DepartmentKR>();

  prev.forEach((row) => {
    byLocalId.set(row.id, row);
    if (
      row.backendDepartmentKrId != null &&
      Number.isFinite(row.backendDepartmentKrId)
    ) {
      byBackendId.set(row.backendDepartmentKrId, row);
    }
  });

  for (const remoteKr of remote) {
    const backendId = remoteKr.backendDepartmentKrId;
    if (backendId == null || !Number.isFinite(backendId)) continue;

    const existing = byBackendId.get(backendId);
    if (existing) {
      const merged: DepartmentKR = {
        ...existing,
        departmentObjectiveId: remoteKr.departmentObjectiveId,
        title: remoteKr.title,
        description: remoteKr.description,
        status: remoteKr.status ?? existing.status,
        metricDefinitionId:
          remoteKr.metricDefinitionId ?? existing.metricDefinitionId,
        unitOfMeasure: remoteKr.unitOfMeasure ?? existing.unitOfMeasure,
        targetValue: remoteKr.targetValue ?? existing.targetValue,
        weightPercent: remoteKr.weightPercent ?? existing.weightPercent,
        progress: remoteKr.progress ?? existing.progress,
        currentValue: remoteKr.currentValue ?? existing.currentValue,
        rejectionComment:
          remoteKr.rejectionComment !== undefined
            ? remoteKr.rejectionComment
            : existing.rejectionComment,
      };
      byBackendId.set(backendId, merged);
      byLocalId.set(existing.id, merged);
      continue;
    }

    const next: DepartmentKR = {
      ...remoteKr,
      id: remoteKr.id,
      backendDepartmentKrId: backendId,
    };
    byBackendId.set(backendId, next);
    byLocalId.set(next.id, next);
  }

  return Array.from(byLocalId.values());
}

/* ================= COMPONENT ================= */

export default function DepartmentPlanningDetail() {
  const { departmentId: paramId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectAuthUser) as any;

  // Robust detection of department ID
  const userDeptId =
    user?.department_id ||
    user?.employee?.department_id ||
    user?.employee?.employments?.[0]?.department_id;

  const departmentId = paramId || (userDeptId ? String(userDeptId) : null);

  // Use path-based layout to prevent sidebar flip
  const isManagerRoute = location.pathname.startsWith("/manager");
  const Layout = isManagerRoute ? EmployeeLayout : AdminLayout;
  const layoutProps = isManagerRoute ? { forceEmployeeSidebar: true } : {};

  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<DepartmentObjective[]>([]);

  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlanItem[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanItem[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]);
  const [departmentKrs, setDepartmentKrs] = useState<DepartmentKR[]>([]);
  const [serverMonthNumbersByBackendKrId, setServerMonthNumbersByBackendKrId] =
    useState<Record<number, number[]>>({});
  const [objSubmitting, setObjSubmitting] = useState(false);
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [planModal, setPlanModal] = useState<PlanModalContext | null>(null);

  const [monthlyForm, setMonthlyForm] = useState({
    departmentObjectiveId: 0,
    departmentKrId: null as number | null,
    monthNumber: 1,
    title: "",
    description: "",
  });

  const [deptKrForm, setDeptKrForm] = useState({
    title: "",
    description: "",
    metricDefinitionId: "",
    unitOfMeasure: "",
    targetValue: "",
    weightPercent: "",
    assignedEmployeeIds: [] as string[],
  });

  const [weeklyForm, setWeeklyForm] = useState({
    monthlyItemId: 0,
    weekNumber: 1,
    title: "",
    description: "",
  });
  const [dailyForm, setDailyForm] = useState({
    weeklyItemId: 0,
    title: "",
  });

  const [employeeSearch, setEmployeeSearch] = useState("");

  const [companyKrCatalog, setCompanyKrCatalog] = useState<CompanyKrOption[]>(
    [],
  );
  const [krCatalogSearch, setKrCatalogSearch] = useState("");
  const [metricDefinitions, setMetricDefinitions] = useState<
    MetricDefinitionOption[]
  >([]);
  const [companyKrMetricMap, setCompanyKrMetricMap] = useState<
    Record<
      number,
      {
        metricDefinitionId?: number;
        metricName?: string;
        unitOfMeasure?: string;
      }
    >
  >({});
  const [loadingAdoptKRs, setLoadingAdoptKRs] = useState(false);
  const [objectiveModalOpen, setObjectiveModalOpen] = useState(false);

  const [objectiveForm, setObjectiveForm] = useState({
    companyKrId: "",
    executionMode: "DIRECT_ADOPTION" as ObjectiveExecutionMode,
    title: "",
    description: "",
  });

  const [executionHydrationKey, setExecutionHydrationKey] = useState(0);

  useEffect(() => {
    setObjectiveForm({
      companyKrId: "",
      executionMode: "DIRECT_ADOPTION",
      title: "",
      description: "",
    });
    setObjectiveModalOpen(false);
  }, [departmentId]);

  useEffect(() => {
    if (!departmentId) return;
    const stored = loadStoredPlan(departmentId);
    setMonthlyPlans(stored.monthly);
    setWeeklyPlans(stored.weekly);
    setDailyPlans(stored.daily);
    setDepartmentKrs(stored.departmentKrs);
    setExecutionHydrationKey((k) => k + 1);
  }, [departmentId]);

  useEffect(() => {
    if (!departmentId || executionHydrationKey === 0) return;
    persistPlan(departmentId, {
      monthly: monthlyPlans,
      weekly: weeklyPlans,
      daily: dailyPlans,
      departmentKrs,
    });
  }, [
    departmentId,
    executionHydrationKey,
    monthlyPlans,
    weeklyPlans,
    dailyPlans,
    departmentKrs,
  ]);

  const fetchObjectives = async () => {
    if (!departmentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = cycleRes?.data?.data ?? cycleRes?.data ?? null;
      const cid = cycle?.id != null ? Number(cycle.id) : null;

      if (!cid) {
        setObjectives([]);
        return;
      }

      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.departmentObjectives,
        query: {
          department_id: Number(departmentId),
          cycle_id: cid,
        },
        isSecureRoute: true,
      });

      const data = res?.data?.data || [];

      setObjectives(
        data.map((obj: any) => ({
          id: Number(obj.id),
          title: obj.title,
          description: obj.description,
          progress: (() => {
            const tgt = Number(obj.target_value ?? 0);
            const cur = Number(obj.current_value ?? 0);
            return tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
          })(),
          company_kr_id: Number(obj.company_kr_id),
          status: (obj.status_code || obj.status || "")
            .toString()
            .toLowerCase(),
          parentMetricDefinitionId: Number(
            obj?.companyKr?.metric_definition_id ??
              obj?.companyKr?.metricDefinition?.id ??
              NaN,
          ),
          parentMetricName:
            obj?.companyKr?.metricDefinition?.name ??
            obj?.companyKr?.metric_name ??
            undefined,
          parentUnitOfMeasure:
            obj?.companyKr?.unit_of_measure ??
            obj?.companyKr?.metricDefinition?.unit_of_measure ??
            undefined,
        })),
      );
    } catch (err) {
      console.error("FETCH OBJECTIVES ERROR", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObjectives();
  }, [departmentId]);

  useEffect(() => {
    let cancelled = false;
    const loadCompanyKrMetricMap = async () => {
      const ids = Array.from(
        new Set(objectives.map((o) => o.company_kr_id).filter(Boolean)),
      );
      if (ids.length === 0) {
        setCompanyKrMetricMap({});
        return;
      }

      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await makeCall({
              method: "GET",
              route: apiRoutes.okr.companyKRById(id),
              isSecureRoute: true,
            });
            const data = res?.data?.data ?? res?.data ?? {};
            return {
              id,
              metricDefinitionId: Number(
                data.metric_definition_id ?? data.metricDefinition?.id ?? NaN,
              ),
              metricName: String(
                data.metricDefinition?.name ?? data.metric_name ?? "",
              ).trim(),
              unitOfMeasure: String(
                data.unit_of_measure ??
                  data.metricDefinition?.unit_of_measure ??
                  "",
              ).trim(),
            };
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;
      const mapped: Record<
        number,
        {
          metricDefinitionId?: number;
          metricName?: string;
          unitOfMeasure?: string;
        }
      > = {};
      results.forEach((row) => {
        if (!row) return;
        mapped[row.id] = {
          metricDefinitionId: Number.isFinite(row.metricDefinitionId)
            ? row.metricDefinitionId
            : undefined,
          metricName: row.metricName || undefined,
          unitOfMeasure: row.unitOfMeasure || undefined,
        };
      });
      setCompanyKrMetricMap(mapped);
    };

    void loadCompanyKrMetricMap();
    return () => {
      cancelled = true;
    };
  }, [objectives]);

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
        const list = Array.isArray(data) ? data : (data?.metrics ?? data?.rows);
        const rows = Array.isArray(list) ? list : [];
        const normalized: MetricDefinitionOption[] = rows
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
      } catch (e) {
        console.error("LOAD METRIC DEFINITIONS", e);
        if (!cancelled) setMetricDefinitions([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitDepartmentKr = async (krId: number) => {
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.departmentKRSubmit(krId),
        isSecureRoute: true,
      });
      ToastService.success("Department Key Result submitted for approval.");
      await fetchObjectives();
    } catch (err: any) {
      console.error("SUBMIT DEPARTMENT Key Result ERROR", err);
      ToastService.error(
        err?.response?.data?.message || err?.message || "Failed to submit KR.",
      );
    }
  };

  const submitDepartmentObjective = async (objectiveId: number) => {
    if (!objectiveId) return;
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.submitDepartmentObjective(objectiveId),
        isSecureRoute: true,
      });
      await fetchObjectives();
      ToastService.success("Department objective submitted for approval.");
    } catch (err: any) {
      console.error("SUBMIT DEPARTMENT OBJECTIVE ERROR", err);
      ToastService.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to submit department objective.",
      );
    }
  };

  const publishDepartmentObjective = async (objectiveId: number) => {
    if (!objectiveId) return;
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.publishDepartmentObjective(objectiveId),
        isSecureRoute: true,
      });
      await fetchObjectives();
      ToastService.success("Department objective published.");
    } catch (err: any) {
      console.error("PUBLISH DEPARTMENT OBJECTIVE ERROR", err);
      ToastService.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to publish department objective.",
      );
    }
  };

  const submitAllDepartmentWork = async () => {
    const draftObjectiveIds = objectives
      .filter((o) => (o.status || "draft") !== "published")
      .map((o) => o.id);

    const krIds = departmentKrs
      .map((kr) => kr.backendDepartmentKrId)
      .filter((id): id is number => id != null);

    if (draftObjectiveIds.length === 0 && krIds.length === 0) {
      ToastService.success("Nothing to submit.");
      return;
    }

    setBulkSubmitting(true);
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.departmentBulkSubmit,
        body: {
          objective_ids: draftObjectiveIds,
          kr_ids: krIds,
        },
        isSecureRoute: true,
      });
      ToastService.success("Department work submitted successfully.");
      await fetchObjectives();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setBulkSubmitting(false);
    }
  };

  const publishAllDepartmentObjectives = async () => {
    const draftIds = objectives
      .filter((o) => (o.status || "draft") !== "published")
      .map((o) => o.id);
    if (draftIds.length === 0) {
      ToastService.success("Nothing to publish.");
      return;
    }
    setBulkSubmitting(true);
    try {
      const results = await Promise.allSettled(
        draftIds.map((id) =>
          makeCall({
            method: "PATCH",
            route: apiRoutes.okr.publishDepartmentObjective(id),
            isSecureRoute: true,
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      await fetchObjectives();
      if (failed === 0) {
        ToastService.success("All department objectives published.");
      } else {
        ToastService.error(
          `${failed} objective(s) failed to publish. Check validations and try again.`,
        );
      }
    } catch (e) {
      console.error("BULK PUBLISH DEPARTMENT OBJECTIVES ERROR", e);
      ToastService.error("Bulk publish failed.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  useEffect(() => {
    if (!departmentId || objectives.length === 0) return;
    let cancelled = false;

    const pullRemotePlans = async () => {
      const remoteDepartmentKrs: DepartmentKR[] = [];
      const remoteMonthly: MonthlyPlanItem[] = [];
      const remoteWeekly: WeeklyPlanItem[] = [];

      for (const obj of objectives) {
        const oid = obj.id;
        let krs: Record<string, unknown>[] = [];
        try {
          const res = await makeCall({
            method: "GET",
            route: apiRoutes.okr.departmentKRs(oid),
            isSecureRoute: true,
          });
          krs = okrAsArray(okrUnwrap(res)) as Record<string, unknown>[];
        } catch {
          continue;
        }

        for (const kr of krs) {
          const backendKrId = Number(kr.id);
          if (!Number.isFinite(backendKrId)) continue;
          const mappedRemoteKr: DepartmentKR = {
            id: -backendKrId,
            departmentObjectiveId: oid,
            title:
              String(kr.title ?? "").trim() ||
              `Department Key Result ${backendKrId}`,
            description: String(kr.description ?? "").trim(),
            status:
              String(kr.status_code ?? kr.status ?? "").toLowerCase() ||
              undefined,
            metricDefinitionId: Number(
              kr.metric_definition_id ??
                (kr.metricDefinition as Record<string, unknown> | undefined)
                  ?.id ??
                NaN,
            ),
            unitOfMeasure: String(
              kr.unit_of_measure ??
                (kr.metricDefinition as Record<string, unknown> | undefined)
                  ?.unit_of_measure ??
                "",
            ).trim(),
            targetValue: Number(kr.target_value ?? NaN),
            weightPercent: Number(kr.weight_percent ?? NaN),
            progress: (() => {
              const tgt = Number(kr.target_value ?? 0);
              const cur = Number(kr.current_value ?? kr.final_value ?? 0);
              return tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
            })(),
            currentValue: Number(kr.current_value ?? kr.final_value ?? 0),
            backendDepartmentKrId: backendKrId,
            rejectionComment: (() => {
              const log = kr.latest_approval_log as
                | { action?: string; comments?: string | null }
                | null
                | undefined;
              if (
                log &&
                (log.action === "CHANGES_REQUESTED" ||
                  log.action === "REJECTED") &&
                log.comments
              ) {
                return String(log.comments);
              }
              return null;
            })(),
          };
          remoteDepartmentKrs.push({
            ...mappedRemoteKr,
            metricDefinitionId: Number.isFinite(
              mappedRemoteKr.metricDefinitionId,
            )
              ? mappedRemoteKr.metricDefinitionId
              : undefined,
            unitOfMeasure: mappedRemoteKr.unitOfMeasure || undefined,
            targetValue: Number.isFinite(mappedRemoteKr.targetValue)
              ? mappedRemoteKr.targetValue
              : undefined,
            weightPercent: Number.isFinite(mappedRemoteKr.weightPercent)
              ? mappedRemoteKr.weightPercent
              : undefined,
          });

          const localKr = departmentKrs.find(
            (k) => k.backendDepartmentKrId === backendKrId,
          );

          try {
            const monthRes = await makeCall({
              method: "GET",
              route: apiRoutes.okr.departmentKRMonthPlans(backendKrId),
              isSecureRoute: true,
            });
            const plans = okrAsArray(okrUnwrap(monthRes)) as Record<
              string,
              unknown
            >[];
            for (const p of plans) {
              const backendMonthPlanId = Number(p.id);
              if (!Number.isFinite(backendMonthPlanId)) continue;
              const month_number = Math.min(
                3,
                Math.max(1, Math.floor(Number(p.month_number) || 1)),
              );
              const desc = String(p.description ?? "").trim();
              remoteMonthly.push({
                id: -backendMonthPlanId,
                departmentObjectiveId: oid,
                departmentKrId: localKr?.id ?? null,
                month_number,
                title: `Month ${month_number}`,
                description: desc,
                progress: 0,
                backendMonthPlanId,
                backendDepartmentKrId: backendKrId,
              });
            }
          } catch {}

          const mergedForLookup = mergeRemoteMonthlyPlans(
            monthlyPlans,
            remoteMonthly,
          );
          const parentMonthlyIdForKr = (): number | null => {
            const row = mergedForLookup.find((m) => {
              if (m.backendDepartmentKrId === backendKrId) return true;
              if (m.departmentKrId == null) return false;
              const lk = departmentKrs.find((k) => k.id === m.departmentKrId);
              return lk?.backendDepartmentKrId === backendKrId;
            });
            return row?.id ?? null;
          };

          try {
            const weekRes = await makeCall({
              method: "GET",
              route: apiRoutes.okr.departmentKRWeeklyPlans(backendKrId),
              isSecureRoute: true,
            });
            const wplans = okrAsArray(okrUnwrap(weekRes)) as Record<
              string,
              unknown
            >[];
            for (const p of wplans) {
              const backendWeeklyPlanId = Number(p.id);
              if (!Number.isFinite(backendWeeklyPlanId)) continue;
              const week_number = Math.min(
                53,
                Math.max(1, Math.floor(Number(p.week_number) || 1)),
              );
              const desc = String(p.description ?? "").trim();
              const parentId = parentMonthlyIdForKr();
              if (parentId == null) continue;
              remoteWeekly.push({
                id: -backendWeeklyPlanId,
                monthlyItemId: parentId,
                week_number,
                title: `Week ${week_number}`,
                description: desc,
                progress: 0,
                backendWeeklyPlanId,
                backendDepartmentKrId: backendKrId,
              });
            }
          } catch {}
        }
      }

      if (!cancelled) {
        setDepartmentKrs((prev) =>
          mergeRemoteDepartmentKrs(prev, remoteDepartmentKrs),
        );
        setMonthlyPlans((prev) => mergeRemoteMonthlyPlans(prev, remoteMonthly));
        setWeeklyPlans((prev) => mergeRemoteWeeklyPlans(prev, remoteWeekly));
      }
    };

    void pullRemotePlans();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, objectives]);

  useEffect(() => {
    if (executionHydrationKey === 0) return;
    setMonthlyPlans((prev) => {
      let changed = false;
      const next = prev.map((m) => {
        if (m.departmentKrId != null) {
          const kr = departmentKrs.find((k) => k.id === m.departmentKrId);
          const b = kr?.backendDepartmentKrId;
          if (b != null && m.backendDepartmentKrId !== b) {
            changed = true;
            return { ...m, backendDepartmentKrId: b };
          }
          return m;
        }
        if (m.backendDepartmentKrId != null) {
          const match = departmentKrs.find(
            (k) => k.backendDepartmentKrId === m.backendDepartmentKrId,
          );
          if (!match) return m;
          changed = true;
          return { ...m, departmentKrId: match.id };
        }
        const first = departmentKrs.find(
          (k) => k.departmentObjectiveId === m.departmentObjectiveId,
        );
        if (!first) return m;
        changed = true;
        return {
          ...m,
          departmentKrId: first.id,
          backendDepartmentKrId:
            first.backendDepartmentKrId ?? m.backendDepartmentKrId,
        };
      });
      return changed ? next : prev;
    });
  }, [executionHydrationKey, departmentKrs]);

  const loadPublishedCompanyKRs = async () => {
    if (!departmentId) return;
    setLoadingAdoptKRs(true);
    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = cycleRes?.data?.data || cycleRes?.data || cycleRes;
      if (!cycle?.id) {
        setCompanyKrCatalog([]);
        return;
      }

      const listRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.companyAvailableKRs,
        query: {
          cycle_id: Number(cycle.id),
          department_id: Number(departmentId),
          // user_id: String(35),
        },
        isSecureRoute: true,
      });
      const raw = listRes?.data?.data ?? listRes?.data ?? [];
      const rows = (Array.isArray(raw) ? raw : [])
        .map((kr: any) => ({
          id: Number(kr.id),
          title: String(kr.title ?? "Key Result").trim(),
          description:
            typeof kr.description === "string" ? kr.description : undefined,
          objectiveTitle: String(kr.objective?.title ?? "Objective"),
          objectiveId: Number(kr.objective?.id ?? 0),
        }))
        .filter((kr: CompanyKrOption) => Number.isFinite(kr.id));
      setCompanyKrCatalog(rows);
    } catch (e) {
      console.error("LOAD COMPANY KRs FOR ADOPT", e);
      setCompanyKrCatalog([]);
    } finally {
      setLoadingAdoptKRs(false);
    }
  };

  useEffect(() => {
    void loadPublishedCompanyKRs();
  }, [departmentId]);

  useEffect(() => {
    let cancelled = false;
    const loadTeam = async () => {
      try {
        const res = await makeCall({
          method: "GET",
          route: apiRoutes.manager.team,
          isSecureRoute: true,
        });
        const list = res?.data?.data?.teamMembers || [];
        if (!cancelled) setTeamMembers(list);
      } catch (e) {
        console.error("LOAD TEAM ERROR", e);
      }
    };
    void loadTeam();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeObjectives = useMemo(() => {
    return objectives.filter((o) => o.status !== "assigned");
  }, [objectives]);

  const adoptKrOptions = useMemo(() => {
    const linked = new Set(
      activeObjectives.map((o) => o.company_kr_id).filter(Boolean),
    );
    return companyKrCatalog.filter((kr) => !linked.has(kr.id));
  }, [companyKrCatalog, activeObjectives]);

  const selectedCatalogKr = useMemo(
    () =>
      adoptKrOptions.find(
        (kr) => String(kr.id) === objectiveForm.companyKrId,
      ) ?? null,
    [adoptKrOptions, objectiveForm.companyKrId],
  );

  useEffect(() => {
    if (!objectiveModalOpen) return;
    if (!selectedCatalogKr) return;
    if (objectiveForm.executionMode === "DIRECT_ADOPTION") {
      setObjectiveForm((prev) => ({
        ...prev,
        title: selectedCatalogKr.title,
        description: selectedCatalogKr.description ?? "",
      }));
    }
  }, [objectiveModalOpen, selectedCatalogKr, objectiveForm.executionMode]);

  const openObjectiveModal = () => {
    const firstKrId = adoptKrOptions[0]?.id;
    setObjectiveForm({
      companyKrId: firstKrId ? String(firstKrId) : "",
      executionMode: "DIRECT_ADOPTION",
      title: adoptKrOptions[0]?.title ?? "",
      description: adoptKrOptions[0]?.description ?? "",
    });
    setObjectiveModalOpen(true);
  };

  const handleCreateDepartmentObjective = async () => {
    if (!departmentId) return;
    const companyKrId = Number(objectiveForm.companyKrId);
    if (!companyKrId) {
      ToastService.error("Select a company key result.");
      return;
    }

    if (
      objectiveForm.executionMode === "CUSTOMIZED" &&
      !objectiveForm.title.trim()
    ) {
      ToastService.error("Custom adoption requires an objective title.");
      return;
    }

    setObjSubmitting(true);
    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.departmentObjectives,
        body: {
          department_id: Number(departmentId),
          company_kr_id: Number(companyKrId),
          execution_mode: objectiveForm.executionMode,
          ...(objectiveForm.executionMode === "CUSTOMIZED"
            ? {
                title: objectiveForm.title.trim(),
                description: objectiveForm.description.trim() || undefined,
              }
            : {}),
        },
        isSecureRoute: true,
      });
      ToastService.success(
        "Department objective created from company key result.",
      );
      setObjectiveModalOpen(false);
      setObjectiveForm({
        companyKrId: "",
        executionMode: "DIRECT_ADOPTION",
        title: "",
        description: "",
      });
      await fetchObjectives();
      await loadPublishedCompanyKRs();
    } catch (err: any) {
      console.error("CREATE DEPARTMENT OBJECTIVE ERROR", err);
      const message = err?.response?.data?.message;
      ToastService.error(
        message || "Could not create objective from this key result.",
      );
    } finally {
      setObjSubmitting(false);
    }
  };

  const objectiveById = useMemo(() => {
    const m = new Map<number, DepartmentObjective>();
    objectives.forEach((o) => m.set(o.id, o));
    return m;
  }, [objectives]);

  const departmentKrById = useMemo(() => {
    const m = new Map<number, DepartmentKR>();
    departmentKrs.forEach((k) => m.set(k.id, k));
    return m;
  }, [departmentKrs]);

  const krsForObjective = (objectiveId: number) =>
    departmentKrs.filter((k) => k.departmentObjectiveId === objectiveId);

  const monthlyById = useMemo(() => {
    const m = new Map<number, MonthlyPlanItem>();
    monthlyPlans.forEach((x) => m.set(x.id, x));
    return m;
  }, [monthlyPlans]);

  const weeklyById = useMemo(() => {
    const m = new Map<number, WeeklyPlanItem>();
    weeklyPlans.forEach((x) => m.set(x.id, x));
    return m;
  }, [weeklyPlans]);

  const monthlyAvgProgress = useMemo(() => {
    if (!monthlyPlans.length) return 0;
    return Math.round(
      monthlyPlans.reduce((s, m) => s + m.progress, 0) / monthlyPlans.length,
    );
  }, [monthlyPlans]);

  const getServerMonthsForSelectedKr = () => {
    const kr =
      monthlyForm.departmentKrId != null
        ? departmentKrs.find((k) => k.id === monthlyForm.departmentKrId)
        : undefined;
    const backendKrId = kr?.backendDepartmentKrId;
    if (backendKrId == null) return null;
    return serverMonthNumbersByBackendKrId[backendKrId] ?? null;
  };

  const weeklyAvgProgress = useMemo(() => {
    if (!weeklyPlans.length) return 0;
    return Math.round(
      weeklyPlans.reduce((s, w) => s + w.progress, 0) / weeklyPlans.length,
    );
  }, [weeklyPlans]);

  const dailyDoneCount = useMemo(() => {
    return dailyPlans.filter((d) => d.done).length;
  }, [dailyPlans]);

  const openMonthlyModal = (
    item: MonthlyPlanItem | null,
    presetObjectiveId?: number,
  ) => {
    if (objectives.length === 0) {
      ToastService.error(
        "Add department objectives first (company CEO assigns or publishes KRs, then assigns or you adopt from company OKR).",
      );
      return;
    }
    const objId =
      item?.departmentObjectiveId ??
      presetObjectiveId ??
      objectives.find((o) => krsForObjective(o.id).length > 0)?.id ??
      objectives[0].id;
    const krs = krsForObjective(objId);
    if (krs.length === 0) {
      ToastService.error(
        "Add at least one department key result under this objective first. Monthly plans are always tied to a department Key Result.",
      );
      return;
    }
    const krId =
      item?.departmentKrId != null &&
      krs.some((k) => k.id === item.departmentKrId)
        ? item.departmentKrId
        : krs[0].id;
    setMonthlyForm({
      departmentObjectiveId: objId,
      departmentKrId: krId,
      monthNumber:
        item?.month_number != null && Number.isFinite(item.month_number)
          ? Math.min(3, Math.max(1, Math.floor(item.month_number)))
          : 1,
      title: item?.title ?? "",
      description: item?.description ?? "",
    });
    setPlanModal({ kind: "monthly", item });
  };

  useEffect(() => {
    if (!planModal || planModal.kind !== "monthly") return;
    const departmentKrId = monthlyForm.departmentKrId;
    if (departmentKrId == null) return;
    const localKr = departmentKrs.find((k) => k.id === departmentKrId);
    const backendKrId = localKr?.backendDepartmentKrId;
    if (backendKrId == null) return;

    let cancelled = false;
    const load = async () => {
      try {
        const monthRes = await makeCall({
          method: "GET",
          route: apiRoutes.okr.departmentKRMonthPlans(backendKrId),
          isSecureRoute: true,
        });
        const rows = okrAsArray(okrUnwrap(monthRes)) as Array<{
          month_number?: number;
        }>;
        const months = Array.from(
          new Set(
            rows
              .map((r) => Math.floor(Number(r.month_number)))
              .filter((n) => Number.isFinite(n) && n >= 1 && n <= 3),
          ),
        ).sort((a, b) => a - b);
        if (cancelled) return;
        setServerMonthNumbersByBackendKrId((prev) => ({
          ...prev,
          [backendKrId]: months,
        }));
      } catch {
        // If load fails, leave uncached; validation falls back to local state.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [planModal, monthlyForm.departmentKrId, departmentKrs]);

  useEffect(() => {
    if (!planModal || planModal.kind !== "monthly") return;
    const serverMonths = getServerMonthsForSelectedKr();
    if (!Array.isArray(serverMonths)) return;
    const maxExisting = serverMonths.length ? Math.max(...serverMonths) : 0;
    const nextValidMonth = Math.min(3, maxExisting + 1);
    if (monthlyForm.monthNumber > nextValidMonth) {
      setMonthlyForm((prev) => ({ ...prev, monthNumber: nextValidMonth }));
    }
  }, [
    planModal,
    monthlyForm.departmentKrId,
    monthlyForm.monthNumber,
    serverMonthNumbersByBackendKrId,
  ]);

  const openDepartmentKrModal = (
    objectiveId: number,
    item: DepartmentKR | null,
  ) => {
    const objective = objectiveById.get(objectiveId);
    const parentMetric =
      companyKrMetricMap[objective?.company_kr_id ?? 0] ?? undefined;
    const parentMetricId = parentMetric?.metricDefinitionId;
    const parentUnit = parentMetric?.unitOfMeasure;
    setDeptKrForm({
      title: item?.title ?? "",
      description: item?.description ?? "",
      metricDefinitionId:
        item?.metricDefinitionId != null
          ? String(item.metricDefinitionId)
          : parentMetricId != null
            ? String(parentMetricId)
            : "",
      unitOfMeasure: item?.unitOfMeasure ?? parentUnit ?? "",
      targetValue: item?.targetValue != null ? String(item.targetValue) : "",
      weightPercent:
        item?.weightPercent != null ? String(item.weightPercent) : "",
      assignedEmployeeIds: [] as string[],
    });

    if (item?.backendDepartmentKrId) {
      void (async () => {
        try {
          const res = await makeCall({
            method: "GET",
            route: apiRoutes.okr.contributors,
            query: { employee_kr_id: item.backendDepartmentKrId },
            isSecureRoute: true,
          });
          const list = res?.data?.data || [];
          const ids = list.map((c: any) => String(c.user_id));
          setDeptKrForm((f) => ({ ...f, assignedEmployeeIds: ids }));
        } catch (e) {
          console.error("LOAD CONTRIBUTORS ERROR", e);
        }
      })();
    }

    setPlanModal({ kind: "department_kr", item, objectiveId });
  };

  const saveDepartmentKrModal = async () => {
    if (!planModal || planModal.kind !== "department_kr") return;
    const metricId = Number(deptKrForm.metricDefinitionId);
    const unit = deptKrForm.unitOfMeasure.trim();
    const target = Number(deptKrForm.targetValue);
    const weight = Number(deptKrForm.weightPercent);

    if (
      !deptKrForm.title.trim() ||
      !Number.isFinite(metricId) ||
      metricId <= 0 ||
      !unit ||
      !Number.isFinite(target) ||
      target < 0 ||
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      ToastService.error("Fill all required Key Result fields.");
      return;
    }

    const { objectiveId, item } = planModal;
    const objective = objectiveById.get(objectiveId);
    const parentMetricId =
      objective != null
        ? companyKrMetricMap[objective.company_kr_id]?.metricDefinitionId
        : undefined;
    if (parentMetricId != null && metricId !== parentMetricId) {
      ToastService.error(
        "Metric must match the parent company Key Result metric for this objective.",
      );
      return;
    }
    const title = deptKrForm.title.trim();
    const description = deptKrForm.description.trim();

    let backendDepartmentKrId = item?.backendDepartmentKrId;

    setPlanSubmitting(true);
    try {
      if (item && backendDepartmentKrId != null) {
        await makeCall({
          method: "PUT",
          route: apiRoutes.okr.departmentKRById(backendDepartmentKrId),
          body: {
            title,
            description,
            metric_definition_id: metricId,
            unit_of_measure: unit,
            target_value: target,
            weight_percent: weight,
            contributes_to_score: true,
            contributes_to_value: true,
            is_mandatory: false,
          },
          isSecureRoute: true,
        });
      } else {
        const res = await makeCall({
          method: "POST",
          route: apiRoutes.okr.departmentKRs(objectiveId),
          body: {
            title,
            description: description || undefined,
            metric_definition_id: metricId,
            unit_of_measure: unit,
            target_value: target,
            weight_percent: weight,
            contributes_to_score: true,
            contributes_to_value: true,
            is_mandatory: false,
          },
          isSecureRoute: true,
        });
        const data = res?.data?.data ?? res?.data;
        if (data?.id != null) {
          backendDepartmentKrId = Number(data.id);
        }
      }
    } catch (err) {
      console.error("Department Key Result API error", err);
      const serverMessage = (err as any)?.response?.data?.message;
      const fallbackMessage = (err as any)?.message;
      ToastService.error(
        serverMessage ||
          fallbackMessage ||
          "Could not sync department Key Result with the server. It is still saved locally for planning.",
      );
    }

    if (item) {
      setDepartmentKrs((prev) =>
        prev.map((k) =>
          k.id === item.id
            ? {
                ...k,
                title,
                description,
                status: k.status ?? "draft",
                metricDefinitionId: metricId,
                unitOfMeasure: unit,
                targetValue: target,
                weightPercent: weight,
                backendDepartmentKrId:
                  backendDepartmentKrId ?? k.backendDepartmentKrId,
              }
            : k,
        ),
      );
    } else {
      setDepartmentKrs((prev) => [
        ...prev,
        {
          id: Date.now(),
          departmentObjectiveId: objectiveId,
          title,
          description,
          status: "draft",
          metricDefinitionId: metricId,
          unitOfMeasure: unit,
          targetValue: target,
          weightPercent: weight,
          backendDepartmentKrId,
        },
      ]);
    }

    // Sync contributors
    if (backendDepartmentKrId) {
      try {
        const contribRes = await makeCall({
          method: "GET",
          route: apiRoutes.okr.contributors,
          query: { employee_kr_id: backendDepartmentKrId },
          isSecureRoute: true,
        });
        const existing = (contribRes?.data?.data || []) as any[];
        const existingUserIds = existing.map((c) => String(c.user_id));
        const newUserIds = deptKrForm.assignedEmployeeIds;

        // Add new ones
        const toAdd = newUserIds.filter((id) => !existingUserIds.includes(id));
        for (const userId of toAdd) {
          await makeCall({
            method: "POST",
            route: apiRoutes.okr.contributors,
            body: {
              employee_kr_id: backendDepartmentKrId,
              user_id: userId,
              role_type: "EMPLOYEE",
              is_required_for_completion: true,
            },
            isSecureRoute: true,
          });
        }

        // Remove old ones
        const toRemove = existing.filter(
          (c) => !newUserIds.includes(String(c.user_id)),
        );
        for (const c of toRemove) {
          await makeCall({
            method: "DELETE",
            route: apiRoutes.okr.contributorById(c.id),
            isSecureRoute: true,
          });
        }
      } catch (syncErr) {
        console.error("SYNC CONTRIBUTORS ERROR", syncErr);
        ToastService.error(
          "Department Key Result updated, but contributor assignment could not be fully synced.",
        );
      }
    }

    setPlanSubmitting(false);
    setPlanModal(null);
  };

  const deleteDepartmentKr = (kr: DepartmentKR) => {
    const linkedMonthIds = monthlyPlans
      .filter((m) => m.departmentKrId === kr.id)
      .map((m) => m.id);
    if (
      linkedMonthIds.length > 0 &&
      !confirm(
        "This department Key Result is linked to monthly plan(s). Delete it and remove those monthly plans (and their weekly/daily items)?",
      )
    ) {
      return;
    }
    if (linkedMonthIds.length > 0) {
      setWeeklyPlans((wp) => {
        const removeWeeklyIds = wp
          .filter((w) => linkedMonthIds.includes(w.monthlyItemId))
          .map((w) => w.id);
        setDailyPlans((dp) =>
          dp.filter((d) => !removeWeeklyIds.includes(d.weeklyItemId)),
        );
        return wp.filter((w) => !linkedMonthIds.includes(w.monthlyItemId));
      });
      setMonthlyPlans((pm) => pm.filter((m) => !linkedMonthIds.includes(m.id)));
    }
    setDepartmentKrs((prev) => prev.filter((x) => x.id !== kr.id));
  };

  const publishDepartmentKr = async (kr: DepartmentKR) => {
    if (!kr.backendDepartmentKrId) {
      ToastService.error(
        "Only synced department Key Results can be published.",
      );
      return;
    }
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.publishDepartmentKR(kr.backendDepartmentKrId),
        isSecureRoute: true,
      });
      ToastService.success("Department Key Result published.");
      await fetchObjectives();
    } catch (err: any) {
      console.error("PUBLISH DEPARTMENT Key Result ERROR", err);
      ToastService.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to publish department KR.",
      );
    }
  };

  const openWeeklyModal = (item: WeeklyPlanItem | null) => {
    if (monthlyPlans.length === 0) {
      ToastService.error("Create at least one monthly plan item first.");
      return;
    }
    setWeeklyForm({
      monthlyItemId: item?.monthlyItemId ?? monthlyPlans[0].id,
      weekNumber:
        item?.week_number != null && Number.isFinite(item.week_number)
          ? Math.min(53, Math.max(1, Math.floor(item.week_number)))
          : 1,
      title: item?.title ?? "",
      description: item?.description ?? "",
    });
    setPlanModal({ kind: "weekly", item });
  };

  const openDailyModal = (item: DailyPlan | null) => {
    if (weeklyPlans.length === 0) {
      ToastService.error("Create at least one weekly plan item first.");
      return;
    }
    setDailyForm({
      weeklyItemId: item?.weeklyItemId ?? weeklyPlans[0].id,
      title: item?.title ?? "",
    });
    setPlanModal({ kind: "daily", item });
  };

  const buildMonthPlanApiDescription = () => {
    const t = monthlyForm.title.trim();
    const d = monthlyForm.description.trim();
    if (t && d) return `${t}: ${d}`;
    return t || d || `Month ${monthlyForm.monthNumber}`;
  };

  const saveMonthlyPlanModal = async () => {
    if (!planModal || planModal.kind !== "monthly") return;
    if (!monthlyForm.title.trim()) return;

    const monthNum = Math.floor(Number(monthlyForm.monthNumber));
    if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 3) {
      ToastService.error("Enter a month number between 1 and 3.");
      return;
    }

    if (
      monthlyForm.departmentKrId == null ||
      !krsForObjective(monthlyForm.departmentObjectiveId).some(
        (k) => k.id === monthlyForm.departmentKrId,
      )
    ) {
      ToastService.error(
        "Select a department key result. Add one under the objective if needed.",
      );
      return;
    }

    const departmentKrId = monthlyForm.departmentKrId;
    const selectedKr = departmentKrs.find((k) => k.id === departmentKrId);
    const backendKrId = selectedKr?.backendDepartmentKrId;
    const prevMonthNeeded = monthNum - 1;

    if (prevMonthNeeded >= 1) {
      let hasPreviousMonth = false;

      if (backendKrId != null) {
        const knownMonths = serverMonthNumbersByBackendKrId[backendKrId];
        if (Array.isArray(knownMonths) && knownMonths.length > 0) {
          hasPreviousMonth = knownMonths.includes(prevMonthNeeded);
        } else {
          // Fall back to local cache check if we haven't loaded server months yet.
          hasPreviousMonth = monthlyPlans.some((m) => {
            if (m.month_number !== prevMonthNeeded) return false;
            if (m.backendDepartmentKrId != null) {
              return m.backendDepartmentKrId === backendKrId;
            }
            return m.departmentKrId === departmentKrId;
          });
        }
      } else {
        hasPreviousMonth = monthlyPlans.some(
          (m) =>
            m.month_number === prevMonthNeeded &&
            m.departmentKrId === departmentKrId,
        );
      }

      if (!hasPreviousMonth) {
        const knownMonths =
          backendKrId != null
            ? serverMonthNumbersByBackendKrId[backendKrId]
            : [];
        const krLabel =
          selectedKr != null
            ? `"${selectedKr.title}"${backendKrId != null ? ` (#${backendKrId})` : ""}`
            : "this department KR";
        ToastService.error(
          `Create Month ${prevMonthNeeded} first for ${krLabel}${
            Array.isArray(knownMonths) && knownMonths.length
              ? ` (server has months: ${knownMonths.join(", ")})`
              : ""
          }.`,
        );
        return;
      }
    }

    let backendMonthPlanId = planModal.item?.backendMonthPlanId;
    const isNew = !planModal.item;

    setPlanSubmitting(true);
    if (isNew && backendKrId != null) {
      try {
        const res = await makeCall({
          method: "POST",
          route: apiRoutes.okr.departmentKRMonthPlan(backendKrId),
          body: {
            month_number: monthNum,
            description: buildMonthPlanApiDescription(),
          },
          isSecureRoute: true,
        });
        const data = res?.data?.data ?? res?.data;
        if (data?.id != null) {
          backendMonthPlanId = Number(data.id);
        }
        setServerMonthNumbersByBackendKrId((prev) => {
          const existing = prev[backendKrId] ?? [];
          if (existing.includes(monthNum)) return prev;
          return {
            ...prev,
            [backendKrId]: [...existing, monthNum].sort((a, b) => a - b),
          };
        });
      } catch (err) {
        console.error("Department month plan API error", err);
        ToastService.error(
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ??
            "Could not create month plan on the server. It is still saved locally.",
        );
      } finally {
        setPlanSubmitting(false);
      }
    } else {
      setPlanSubmitting(false);
    }

    const title = monthlyForm.title.trim();
    const description = monthlyForm.description.trim();

    if (planModal.item) {
      setMonthlyPlans((prev) =>
        prev.map((m) =>
          m.id === planModal.item!.id
            ? {
                ...m,
                departmentObjectiveId: monthlyForm.departmentObjectiveId,
                departmentKrId,
                month_number: monthNum,
                title,
                description,
                backendMonthPlanId: backendMonthPlanId ?? m.backendMonthPlanId,
                backendDepartmentKrId: backendKrId ?? m.backendDepartmentKrId,
              }
            : m,
        ),
      );
    } else {
      setMonthlyPlans((prev) => [
        ...prev,
        {
          id: Date.now(),
          departmentObjectiveId: monthlyForm.departmentObjectiveId,
          departmentKrId,
          month_number: monthNum,
          title,
          description,
          progress: 0,
          backendMonthPlanId,
          backendDepartmentKrId: backendKrId,
        },
      ]);
    }

    setPlanModal(null);
  };

  const buildWeekPlanApiDescription = () => {
    const t = weeklyForm.title.trim();
    const d = weeklyForm.description.trim();
    if (t && d) return `${t}: ${d}`;
    return t || d || `Week ${weeklyForm.weekNumber}`;
  };

  const saveWeeklyPlanModal = async () => {
    if (!planModal || planModal.kind !== "weekly") return;
    if (!weeklyForm.title.trim()) return;

    const weekNum = Math.floor(Number(weeklyForm.weekNumber));
    if (!Number.isFinite(weekNum) || weekNum < 1 || weekNum > 53) {
      ToastService.error("Enter a week number between 1 and 53.");
      return;
    }

    const parentMonthly = monthlyPlans.find(
      (m) => m.id === weeklyForm.monthlyItemId,
    );
    if (!parentMonthly) {
      ToastService.error("Select a valid parent monthly item.");
      return;
    }

    const backendKrId =
      parentMonthly.backendDepartmentKrId ??
      (parentMonthly.departmentKrId != null
        ? departmentKrs.find((k) => k.id === parentMonthly.departmentKrId)
            ?.backendDepartmentKrId
        : undefined);

    let backendWeeklyPlanId = planModal.item?.backendWeeklyPlanId;
    const isNew = !planModal.item;

    if (backendKrId == null && isNew) {
      ToastService.error(
        "This monthly plan has no synced department Key Result yet — the weekly item will be saved locally only until the Key Result syncs ",
      );
    }

    setPlanSubmitting(true);
    if (isNew && backendKrId != null) {
      try {
        const res = await makeCall({
          method: "POST",
          route: apiRoutes.okr.departmentKRWeeklyPlan(backendKrId),
          body: {
            week_number: weekNum,
            description: buildWeekPlanApiDescription(),
          },
          isSecureRoute: true,
        });
        const data = res?.data?.data ?? res?.data;
        if (data?.id != null) {
          backendWeeklyPlanId = Number(data.id);
        }
      } catch (err) {
        console.error("Department weekly plan API error", err);
        ToastService.error(
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ??
            "Could not create weekly plan on the server. It is still saved locally.",
        );
      } finally {
        setPlanSubmitting(false);
      }
    } else {
      setPlanSubmitting(false);
    }

    const title = weeklyForm.title.trim();
    const description = weeklyForm.description.trim();

    if (planModal.item) {
      setWeeklyPlans((prev) =>
        prev.map((w) =>
          w.id === planModal.item!.id
            ? {
                ...w,
                monthlyItemId: weeklyForm.monthlyItemId,
                week_number: weekNum,
                title,
                description,
                backendWeeklyPlanId:
                  backendWeeklyPlanId ?? w.backendWeeklyPlanId,
                backendDepartmentKrId: backendKrId ?? w.backendDepartmentKrId,
              }
            : w,
        ),
      );
    } else {
      setWeeklyPlans((prev) => [
        ...prev,
        {
          id: Date.now(),
          monthlyItemId: weeklyForm.monthlyItemId,
          week_number: weekNum,
          title,
          description,
          progress: 0,
          backendWeeklyPlanId,
          backendDepartmentKrId: backendKrId,
        },
      ]);
    }

    setPlanModal(null);
  };

  const savePlanModal = () => {
    if (!planModal) return;

    if (planModal.kind === "monthly") {
      void saveMonthlyPlanModal();
      return;
    } else if (planModal.kind === "weekly") {
      void saveWeeklyPlanModal();
      return;
    } else {
      if (!dailyForm.title.trim()) return;
      if (planModal.item) {
        setDailyPlans((prev) =>
          prev.map((d) =>
            d.id === planModal.item!.id
              ? {
                  ...d,
                  weeklyItemId: dailyForm.weeklyItemId,
                  title: dailyForm.title.trim(),
                }
              : d,
          ),
        );
      } else {
        setDailyPlans((prev) => [
          ...prev,
          {
            id: Date.now(),
            weeklyItemId: dailyForm.weeklyItemId,
            title: dailyForm.title.trim(),
            done: false,
          },
        ]);
      }
    }

    setPlanModal(null);
  };

  const deleteMonthly = (id: number) => {
    if (!confirm("Remove this monthly item and unlink weekly/daily items?"))
      return;
    setWeeklyPlans((wp) => {
      const removedWeeklyIds = wp
        .filter((w) => w.monthlyItemId === id)
        .map((w) => w.id);
      setDailyPlans((dp) =>
        dp.filter((d) => !removedWeeklyIds.includes(d.weeklyItemId)),
      );
      return wp.filter((w) => w.monthlyItemId !== id);
    });
    setMonthlyPlans((pm) => pm.filter((m) => m.id !== id));
  };

  const deleteWeekly = (id: number) => {
    if (!confirm("Remove this weekly item and its daily plans?")) return;
    setWeeklyPlans((prev) => prev.filter((w) => w.id !== id));
    setDailyPlans((prev) => prev.filter((d) => d.weeklyItemId !== id));
  };

  const deleteDaily = (id: number) => {
    setDailyPlans((prev) => prev.filter((d) => d.id !== id));
  };

  const toggleDailyDone = (id: number) => {
    setDailyPlans((prev) =>
      prev.map((d) => (d.id === id ? { ...d, done: !d.done } : d)),
    );
  };

  const setMonthlyProgress = (id: number, progress: number) => {
    setMonthlyPlans((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, progress: Math.min(100, Math.max(0, progress)) }
          : m,
      ),
    );
  };

  const setWeeklyProgress = (id: number, progress: number) => {
    setWeeklyPlans((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, progress: Math.min(100, Math.max(0, progress)) }
          : w,
      ),
    );
  };

  if (!departmentId) {
    return (
      <Layout {...layoutProps}>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="bg-white rounded-3xl p-10 max-w-lg border border-gray-100 shadow-2xl shadow-gray-200/50">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-amber-100">
              <MdAccountTree className="text-3xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Department Detached
            </h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              We couldn't identify your department automatically. This is
              usually due to an expired or legacy session.
              <br />
              <span className="text-[10px] font-bold text-indigo-500 tracking-widest mt-4 block">
                System refinement v2.1
              </span>
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  window.location.href = "/login";
                }}
                className="w-full bg-slate-900 text-white rounded-2xl py-4 font-semibold hover:bg-black transition-all shadow-lg shadow-black/10 active:scale-[0.98]"
              >
                Refresh Authentication
              </button>
              <p className="text-xs text-gray-400">
                You will be redirected to the secure login page.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout {...layoutProps}>
        <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded-xl w-1/3" />
          <div className="h-48 bg-gray-100 rounded-2xl" />
          <div className="h-48 bg-gray-100 rounded-2xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout {...layoutProps}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          <nav className="flex flex-wrap items-center gap-2 text-sm pt-4">
            <button
              type="button"
              onClick={() => navigate(routeConstants.okr)}
              className="text-gray-500 hover:text-gray-800"
            >
              OKR
            </button>
            <MdChevronRight className="text-gray-300 shrink-0" />
            <button
              type="button"
              onClick={() => navigate(routeConstants.okrDepartmentPlanning)}
              className="text-gray-500 hover:text-gray-800"
            >
              Departments
            </button>
            <MdChevronRight className="text-gray-300 shrink-0" />
            <span className="text-gray-800 font-medium truncate">
              Department {departmentId}
            </span>
          </nav>

          <PageHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3 text-white">
                <span className="rounded-xl bg-white/15 p-2 ring-1 ring-white/20 shrink-0">
                  <MdAccountTree className="text-2xl" />
                </span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Department Execution
                  </h1>
                  <p className="text-white/85 text-sm mt-1 max-w-2xl">
                    Plan Department Execution From Company-Linked Objectives.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RefreshButton onClick={fetchObjectives} loading={loading} />
                {activeObjectives.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void submitAllDepartmentWork()}
                      disabled={bulkSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-sm font-medium text-gray-900 shadow-md shadow-black/10 ring-1 ring-black/5 hover:bg-white disabled:opacity-50"
                    >
                      {bulkSubmitting ? "Submitting..." : "Submit Selected"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void publishAllDepartmentObjectives()}
                      disabled={bulkSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-sm font-medium text-gray-900 shadow-md shadow-black/10 ring-1 ring-black/5 hover:bg-white disabled:opacity-50"
                    >
                      <MdPublish className="text-lg text-primary" />
                      {bulkSubmitting ? "Publishing..." : "Publish All"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </PageHeader>

          {/* Summary strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <MetricStat
                label="Monthly Items"
                value={monthlyPlans.length}
                progress={monthlyAvgProgress}
              />
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <MetricStat
                label="Weekly Focuses"
                value={weeklyPlans.length}
                progress={weeklyAvgProgress}
              />
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <MetricStat
                label="Daily Plans"
                value={
                  dailyPlans.length
                    ? `${dailyDoneCount}/${dailyPlans.length} done`
                    : "—"
                }
              />
            </div>
          </div>

          {/* Department objectives (company KR lineage) */}
          <section>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  Department Objectives
                </h2>
                <p className="text-sm text-gray-500">
                  Objectives linked to company KRs for this department.
                </p>
              </div>
              {activeObjectives.length > 0 && (
                <button
                  type="button"
                  onClick={openObjectiveModal}
                  disabled={loadingAdoptKRs || adoptKrOptions.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MdAdd className="text-base" />
                  New Objective
                </button>
              )}
            </div>

            {activeObjectives.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-8 py-16 flex flex-col items-center text-center justify-center">
                <MdTrackChanges className="mx-auto text-4xl text-gray-300 mb-3" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  No Department Objectives Yet
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto mb-6">
                  Create a department objective from assigned company key
                  results.
                </p>
                <button
                  type="button"
                  onClick={openObjectiveModal}
                  disabled={loadingAdoptKRs || adoptKrOptions.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MdAdd className="text-base" />
                  New Objective
                </button>

                {!loadingAdoptKRs && companyKrCatalog.length === 0 && (
                  <p className="text-xs text-amber-700/90 mt-4 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                    No assigned company key results available for this cycle.
                    Ask the CEO to assign this department from company OKR.
                  </p>
                )}
                {!loadingAdoptKRs &&
                  companyKrCatalog.length > 0 &&
                  adoptKrOptions.length === 0 && (
                    <p className="text-xs text-amber-700/90 mt-4 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                      All available company key results are already linked to
                      this department.
                    </p>
                  )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {activeObjectives.map((obj) => {
                  const objectiveKRs = krsForObjective(obj.id);
                  return (
                    <ObjectiveCard
                      key={obj.id}
                      id={`DO-${obj.id}`}
                      title={obj.title}
                      status={obj.status || "draft"}
                      progress={obj.progress || 0}
                      krsCount={objectiveKRs.length}
                      expandable={objectiveKRs.length > 0}
                      defaultExpanded={false}
                      headerContext={
                        obj.description && (
                          <BulletText
                            text={obj.description}
                            className="text-xs text-slate-500 line-clamp-1"
                          />
                        )
                      }
                      actions={(() => {
                        const s = (obj.status || "draft").toLowerCase();
                        return (
                          <div className="flex flex-wrap gap-2 flex-1 justify-end">
                            {s === "draft" && (
                              <button
                                type="button"
                                onClick={() =>
                                  openDepartmentKrModal(obj.id, null)
                                }
                                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 tracking-widest font-space transition-colors"
                              >
                                <MdAdd className="text-sm" />
                                Add KR
                              </button>
                            )}
                            {s === "draft" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void submitDepartmentObjective(obj.id)
                                }
                                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 tracking-widest font-space transition-colors"
                              >
                                Submit
                              </button>
                            )}
                            {s === "approved" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void publishDepartmentObjective(obj.id)
                                }
                                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 tracking-widest font-space transition-colors"
                              >
                                <MdPublish className="text-sm" />
                                Publish
                              </button>
                            )}
                            {s !== "published" && (
                              <button
                                type="button"
                                onClick={() => openMonthlyModal(null, obj.id)}
                                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 tracking-widest font-space transition-colors"
                              >
                                <MdCalendarMonth className="text-sm" />
                                Monthly Plan
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    >
                      <div className="space-y-3">
                        {objectiveKRs.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            No department KRs yet — add at least one before
                            monthly planning.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {objectiveKRs.map((kr) => {
                              const syncLabel =
                                kr.backendDepartmentKrId != null ? (
                                  <span className="text-[10px] text-emerald-600 font-space font-bold tracking-widest">
                                    Synced
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-600 font-space font-bold tracking-widest">
                                    Local only
                                  </span>
                                );

                              const alertBanner =
                                kr.rejectionComment && kr.status === "draft" ? (
                                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                                    <span className="text-red-500 text-base shrink-0 mt-0.5">
                                      ⚠
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-bold text-red-800 tracking-widest font-space">
                                        Changes requested
                                      </p>
                                      <p className="text-[11px] text-red-700 mt-1 leading-snug">
                                        {kr.rejectionComment}
                                      </p>
                                      <p className="text-[10px] text-red-600 mt-1.5 italic">
                                        Edit this Key Resultthen click Submit to
                                        resubmit.
                                      </p>
                                    </div>
                                  </div>
                                ) : null;

                              return (
                                <KeyResultListItem
                                  key={kr.id}
                                  title={kr.title}
                                  status={
                                    kr.status === "published"
                                      ? "published"
                                      : "draft"
                                  }
                                  progress={kr.progress ?? 0}
                                  targetString={`${kr.currentValue ?? 0} / ${kr.targetValue ?? 0} ${kr.unitOfMeasure}`}
                                  subtitle={
                                    <div className="flex flex-col gap-1">
                                      {syncLabel}
                                      {kr.description && (
                                        <BulletText
                                          text={kr.description}
                                          className="text-xs text-slate-500 line-clamp-1 mt-1"
                                        />
                                      )}
                                    </div>
                                  }
                                  alertBanner={alertBanner}
                                  actions={(() => {
                                    const s = String(
                                      kr.status || "draft",
                                    ).toLowerCase();
                                    const isLocked =
                                      s === "approved" || s === "published";
                                    return (
                                      <>
                                        {kr.backendDepartmentKrId != null &&
                                          !isLocked && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                submitDepartmentKr(
                                                  kr.backendDepartmentKrId!,
                                                )
                                              }
                                              className="rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 bg-emerald-50 tracking-widest font-space transition-colors"
                                            >
                                              Submit
                                            </button>
                                          )}
                                        {kr.backendDepartmentKrId != null &&
                                          s === "approved" && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void publishDepartmentKr(kr)
                                              }
                                              className="rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 bg-indigo-50 tracking-widest font-space transition-colors"
                                            >
                                              Publish
                                            </button>
                                          )}
                                        {!isLocked && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openDepartmentKrModal(obj.id, kr)
                                            }
                                            className="rounded-lg p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                                            aria-label="Edit department KR"
                                          >
                                            <MdEdit className="text-base" />
                                          </button>
                                        )}
                                        {!isLocked && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              deleteDepartmentKr(kr)
                                            }
                                            className="rounded-lg p-2 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                            aria-label="Delete department KR"
                                          >
                                            <MdDeleteOutline className="text-base" />
                                          </button>
                                        )}
                                      </>
                                    );
                                  })()}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </ObjectiveCard>
                  );
                })}
              </div>
            )}
          </section>

          {/* Monthly */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div className="flex items-center gap-2 text-gray-900">
                <MdCalendarMonth className="text-xl text-primary" />
                <div>
                  <h2 className="font-semibold">Monthly Planning</h2>
                  <p className="text-xs text-gray-500">
                    Monthly plans linked to department KRs.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openMonthlyModal(null)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15"
                >
                  <MdAdd />
                  Add Monthly Item
                </button>
              </div>
            </div>
            {monthlyPlans.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-100 rounded-xl">
                No monthly plans yet. Add a department Key Result on an
                objective card, then create a plan (POST …/key-results/{"{"}id
                {"}"}/month-plan when the Key Result is synced).
              </p>
            ) : (
              <ul className="space-y-3">
                {monthlyPlans.map((m) => {
                  const parent = objectiveById.get(m.departmentObjectiveId);
                  const subKr =
                    m.departmentKrId != null
                      ? departmentKrById.get(m.departmentKrId)
                      : undefined;
                  return (
                    <li
                      key={m.id}
                      className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-slate-50/50 p-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{m.title}</p>
                        {m.description ? (
                          <BulletText
                            text={m.description}
                            className="text-sm text-gray-600 mt-1"
                          />
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 ring-1 ring-primary/20 text-primary font-medium tabular-nums">
                            Month {m.month_number}
                          </span>
                          {parent ? (
                            <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-gray-200 text-gray-600 truncate max-w-[14rem]">
                              Objective: {parent.title}
                            </span>
                          ) : null}
                          {subKr ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 ring-1 ring-primary/20 text-primary truncate max-w-[14rem]">
                              Dept KR: {subKr.title}
                            </span>
                          ) : m.backendDepartmentKrId != null ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 ring-1 ring-gray-200 text-gray-700 truncate max-w-[14rem]">
                              Dept KR (server id {m.backendDepartmentKrId})
                            </span>
                          ) : null}
                          {m.backendMonthPlanId != null ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 ring-1 ring-emerald-100 text-emerald-800 text-[11px]">
                              Server month plan #{m.backendMonthPlanId}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex items-center gap-2 max-w-xs">
                          <label className="text-xs text-gray-500 whitespace-nowrap">
                            Progress
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={m.progress}
                            onChange={(e) =>
                              setMonthlyProgress(m.id, Number(e.target.value))
                            }
                            className="flex-1"
                          />
                          <span className="text-xs font-medium tabular-nums w-8">
                            {m.progress}%
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openMonthlyModal(m)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-white"
                          aria-label="Edit"
                        >
                          <MdEdit />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMonthly(m.id)}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                          aria-label="Delete"
                        >
                          <MdDeleteOutline />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Weekly */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div className="flex items-center gap-2 text-gray-900">
                <MdDateRange className="text-xl text-primary" />
                <div>
                  <h2 className="font-semibold">Weekly Planning</h2>
                  <p className="text-xs text-gray-500">
                    Weekly plans linked to monthly execution.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openWeeklyModal(null)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15"
                >
                  <MdAdd />
                  Add Weekly Focus
                </button>
              </div>
            </div>
            {weeklyPlans.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-100 rounded-xl">
                No weekly items yet. Add monthly plans (each tied to a dept KR)
                first.
              </p>
            ) : (
              <ul className="space-y-3">
                {weeklyPlans.map((w) => {
                  const monthParent = monthlyById.get(w.monthlyItemId);
                  const wn = w.week_number ?? 1;
                  return (
                    <li
                      key={w.id}
                      className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-slate-50/50 p-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{w.title}</p>
                        {w.description ? (
                          <BulletText
                            text={w.description}
                            className="text-sm text-gray-600 mt-1"
                          />
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 ring-1 ring-primary/20 text-primary font-medium tabular-nums">
                            Week {wn}
                          </span>
                          {w.backendWeeklyPlanId != null ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 ring-1 ring-emerald-100 text-emerald-800 text-[11px]">
                              Server weekly #{w.backendWeeklyPlanId}
                            </span>
                          ) : null}
                        </div>
                        {monthParent ? (
                          <p className="text-xs text-gray-500 mt-2 truncate">
                            Monthly (M{monthParent.month_number}):{" "}
                            {monthParent.title}
                          </p>
                        ) : null}
                        <div className="mt-3 flex items-center gap-2 max-w-xs">
                          <label className="text-xs text-gray-500">
                            Progress
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={w.progress}
                            onChange={(e) =>
                              setWeeklyProgress(w.id, Number(e.target.value))
                            }
                            className="flex-1"
                          />
                          <span className="text-xs font-medium tabular-nums w-8">
                            {w.progress}%
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openWeeklyModal(w)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-white"
                        >
                          <MdEdit />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteWeekly(w.id)}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        >
                          <MdDeleteOutline />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Daily */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div className="flex items-center gap-2 text-gray-900">
                <MdToday className="text-xl text-primary" />
                <div>
                  <h2 className="font-semibold">Daily Plans</h2>
                  <p className="text-xs text-gray-500">
                    Daily plans linked to weekly plans.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openDailyModal(null)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15"
                >
                  <MdAdd />
                  Add Daily Plan
                </button>
              </div>
            </div>
            {dailyPlans.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-100 rounded-xl">
                No daily plans yet. Add weekly focuses first.
              </p>
            ) : (
              <ul className="space-y-2">
                {dailyPlans.map((d) => {
                  const wk = weeklyById.get(d.weeklyItemId);
                  return (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-slate-50/50 px-4 py-3"
                    >
                      <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={d.done}
                          onChange={() => toggleDailyDone(d.id)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span
                          className={`text-sm ${
                            d.done
                              ? "text-gray-400 line-through"
                              : "text-gray-900"
                          }`}
                        >
                          {d.title}
                        </span>
                      </label>
                      {wk ? (
                        <span className="text-xs text-gray-500 truncate max-w-[10rem] sm:max-w-xs">
                          W{wk.week_number ?? 1}: {wk.title}
                        </span>
                      ) : null}
                      <div className="flex gap-1 ml-auto">
                        <button
                          type="button"
                          onClick={() => openDailyModal(d)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-white"
                        >
                          <MdEdit className="text-lg" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDaily(d.id)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        >
                          <MdDeleteOutline className="text-lg" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ModalLayout
        isOpen={objectiveModalOpen}
        onClose={() => setObjectiveModalOpen(false)}
        title="New Department Objective"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Assigned Company Key Result
            </label>
            <div className="mb-2">
              <input
                type="text"
                placeholder="Search key results..."
                value={krCatalogSearch}
                onChange={(e) => setKrCatalogSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/25"
              />
            </div>
            <select
              value={objectiveForm.companyKrId}
              onChange={(e) =>
                setObjectiveForm((prev) => ({
                  ...prev,
                  companyKrId: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 bg-white"
            >
              <option value="">Select a Key Result...</option>
              {adoptKrOptions
                .filter(kr => 
                  kr.title.toLowerCase().includes(krCatalogSearch.toLowerCase()) || 
                  kr.objectiveTitle.toLowerCase().includes(krCatalogSearch.toLowerCase())
                )
                .map((kr) => (
                  <option key={kr.id} value={String(kr.id)}>
                    {kr.title} — {kr.objectiveTitle}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-500">
              Adoption Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setObjectiveForm((prev) => ({
                    ...prev,
                    executionMode: "DIRECT_ADOPTION",
                  }))
                }
                className={`rounded-xl border px-3 py-2 text-sm text-left ${
                  objectiveForm.executionMode === "DIRECT_ADOPTION"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-slate-50"
                }`}
              >
                Direct Adoption
              </button>
              <button
                type="button"
                onClick={() =>
                  setObjectiveForm((prev) => ({
                    ...prev,
                    executionMode: "CUSTOMIZED",
                  }))
                }
                className={`rounded-xl border px-3 py-2 text-sm text-left ${
                  objectiveForm.executionMode === "CUSTOMIZED"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-slate-50"
                }`}
              >
                Custom Adoption
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Objective Title
            </label>
            <input
              value={
                objectiveForm.executionMode === "DIRECT_ADOPTION"
                  ? (selectedCatalogKr?.title ?? "")
                  : objectiveForm.title
              }
              onChange={(e) =>
                setObjectiveForm((prev) => ({ ...prev, title: e.target.value }))
              }
              disabled={objectiveForm.executionMode === "DIRECT_ADOPTION"}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:bg-slate-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Objective Description
            </label>
            <BulletTextarea
              value={
                objectiveForm.executionMode === "DIRECT_ADOPTION"
                  ? (selectedCatalogKr?.description ?? "")
                  : objectiveForm.description
              }
              onValueChange={(value) =>
                setObjectiveForm((prev) => ({
                  ...prev,
                  description: value,
                }))
              }
              disabled={objectiveForm.executionMode === "DIRECT_ADOPTION"}
              className="min-h-[88px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:bg-slate-50 disabled:text-gray-500"
            />
          </div>
        </div>
        <ApprovalFooter
          onCancel={() => setObjectiveModalOpen(false)}
          onConfirm={() => void handleCreateDepartmentObjective()}
          confirmText={objSubmitting ? "Saving..." : "Create Objective"}
          confirmDisabled={!objectiveForm.companyKrId || objSubmitting}
        />
      </ModalLayout>

      {/* Plan modals */}
      <ModalLayout
        isOpen={planModal?.kind === "monthly"}
        onClose={() => setPlanModal(null)}
        title={
          planModal?.kind === "monthly" && planModal.item
            ? "Edit Monthly Plan"
            : "New Monthly Plan"
        }
        maxWidthClass="max-w-lg"
      >
        {planModal?.kind === "monthly" ? (
          <>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Department Objective
                </label>
                <select
                  value={monthlyForm.departmentObjectiveId || ""}
                  onChange={(e) => {
                    const oid = Number(e.target.value);
                    setMonthlyForm((f) => {
                      const krs = departmentKrs.filter(
                        (k) => k.departmentObjectiveId === oid,
                      );
                      const nextKr =
                        f.departmentKrId != null &&
                        krs.some((k) => k.id === f.departmentKrId)
                          ? f.departmentKrId
                          : (krs[0]?.id ?? null);
                      return {
                        ...f,
                        departmentObjectiveId: oid,
                        departmentKrId: nextKr,
                      };
                    });
                  }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                >
                  {objectives.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Department Key Result
                </label>
                <select
                  value={
                    monthlyForm.departmentKrId != null
                      ? String(monthlyForm.departmentKrId)
                      : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setMonthlyForm((f) => ({
                      ...f,
                      departmentKrId: v ? Number(v) : null,
                    }));
                  }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                >
                  <option value="">Select a Department KR...</option>
                  {krsForObjective(monthlyForm.departmentObjectiveId).map(
                    (kr) => (
                      <option key={kr.id} value={kr.id}>
                        {kr.title}
                        {kr.backendDepartmentKrId != null
                          ? ` (synced #${kr.backendDepartmentKrId})`
                          : " (local — sync KR first to POST)"}
                      </option>
                    ),
                  )}
                </select>
                {krsForObjective(monthlyForm.departmentObjectiveId).length ===
                0 ? (
                  <p className="text-xs text-amber-700 mt-2 rounded-lg bg-amber-50 px-2 py-1.5 ring-1 ring-amber-100">
                    Add a department KR on the objective card first. Monthly
                    plans always use{" "}
                    <code className="text-[11px]">department_kr_id</code> on the
                    API.
                  </p>
                ) : null}
                {(() => {
                  const kr =
                    monthlyForm.departmentKrId != null
                      ? departmentKrs.find(
                          (k) => k.id === monthlyForm.departmentKrId,
                        )
                      : null;
                  const backendId = kr?.backendDepartmentKrId;
                  if (backendId == null) return null;
                  const months = serverMonthNumbersByBackendKrId[backendId];
                  if (!Array.isArray(months)) return null;
                  return (
                    <p className="text-[11px] text-gray-500 mt-2">
                      Server month plans for this KR:{" "}
                      {months.length ? months.join(", ") : "none yet"}
                    </p>
                  );
                })()}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Month Number
                </label>
                {(() => {
                  const months = getServerMonthsForSelectedKr();
                  if (!Array.isArray(months)) return null;
                  const maxExisting = months.length ? Math.max(...months) : 0;
                  const nextValidMonth = Math.min(3, maxExisting + 1);
                  return (
                    <p className="text-[11px] text-gray-500 mb-1.5">
                      Next valid month for selected KR: {nextValidMonth}
                    </p>
                  );
                })()}
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={monthlyForm.monthNumber}
                  onChange={(e) => {
                    const v = e.target.value;
                    const parsed = v === "" ? 1 : Number(v);
                    const serverMonths = getServerMonthsForSelectedKr();
                    if (Array.isArray(serverMonths)) {
                      const maxExisting = serverMonths.length
                        ? Math.max(...serverMonths)
                        : 0;
                      const nextValidMonth = Math.min(3, maxExisting + 1);
                      setMonthlyForm((f) => ({
                        ...f,
                        monthNumber: Math.min(
                          nextValidMonth,
                          Math.max(1, parsed),
                        ),
                      }));
                      return;
                    }
                    setMonthlyForm((f) => ({
                      ...f,
                      monthNumber: parsed,
                    }));
                  }}
                  className="w-full max-w-[8rem] rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 tabular-nums"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Use month number 1 to 3. Planning is sequential per KR, so
                  Month 2 requires Month 1, and Month 3 requires Month 2.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Monthly Focus Title
                </label>
                <input
                  value={monthlyForm.title}
                  onChange={(e) =>
                    setMonthlyForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="What This Department Ships This Month"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Notes
                </label>
                <BulletTextarea
                  value={monthlyForm.description}
                  onValueChange={(value) =>
                    setMonthlyForm((f) => ({
                      ...f,
                      description: value,
                    }))
                  }
                  placeholder="Optional: Scope, Owners, Dependencies"
                  className="min-h-[88px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </div>
            </div>
            <ApprovalFooter
              onCancel={() => setPlanModal(null)}
              onConfirm={savePlanModal}
              confirmText={
                planSubmitting
                  ? planModal.item
                    ? "Saving..."
                    : "Adding..."
                  : planModal.item
                    ? "Save"
                    : "Add"
              }
              confirmDisabled={planSubmitting}
            />
          </>
        ) : null}
      </ModalLayout>

      <ModalLayout
        isOpen={planModal?.kind === "weekly"}
        onClose={() => setPlanModal(null)}
        title={
          planModal?.kind === "weekly" && planModal.item
            ? "Edit Weekly Focus"
            : "New Weekly Focus"
        }
        maxWidthClass="max-w-lg"
      >
        {planModal?.kind === "weekly" ? (
          <>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Parent Monthly Plan (Provides Department KR)
                </label>
                <select
                  value={weeklyForm.monthlyItemId || ""}
                  onChange={(e) =>
                    setWeeklyForm((f) => ({
                      ...f,
                      monthlyItemId: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                >
                  {monthlyPlans.map((m) => {
                    const kr =
                      m.departmentKrId != null
                        ? departmentKrById.get(m.departmentKrId)
                        : undefined;
                    const krPart =
                      kr?.title ??
                      (m.backendDepartmentKrId != null
                        ? `KR #${m.backendDepartmentKrId}`
                        : "KR ?");
                    return (
                      <option key={m.id} value={m.id}>
                        M{m.month_number}: {m.title} · {krPart}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Week Number
                </label>
                <input
                  type="number"
                  min={1}
                  max={53}
                  value={weeklyForm.weekNumber}
                  onChange={(e) => {
                    const v = e.target.value;
                    setWeeklyForm((f) => ({
                      ...f,
                      weekNumber: v === "" ? 1 : Number(v),
                    }));
                  }}
                  className="w-full max-w-[8rem] rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 tabular-nums"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Sent as <code className="text-[11px]">week_number</code> on
                  POST{" "}
                  <code className="text-[11px]">
                    /okr/department/key-results/{"{"}id{"}"}/weekly-plan
                  </code>
                  .
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Weekly Deliverable
                </label>
                <input
                  value={weeklyForm.title}
                  onChange={(e) =>
                    setWeeklyForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="E.g., Ship Reporting Dashboard MVP"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Notes (Optional)
                </label>
                <BulletTextarea
                  value={weeklyForm.description}
                  onValueChange={(value) =>
                    setWeeklyForm((f) => ({
                      ...f,
                      description: value,
                    }))
                  }
                  className="min-h-[72px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </div>
            </div>
            <ApprovalFooter
              onCancel={() => setPlanModal(null)}
              onConfirm={savePlanModal}
              confirmText={
                planSubmitting
                  ? planModal.item
                    ? "Saving..."
                    : "Adding..."
                  : planModal.item
                    ? "Save"
                    : "Add"
              }
              confirmDisabled={planSubmitting}
            />
          </>
        ) : null}
      </ModalLayout>

      <ModalLayout
        isOpen={planModal?.kind === "daily"}
        onClose={() => setPlanModal(null)}
        title={
          planModal?.kind === "daily" && planModal.item
            ? "Edit Daily Plan"
            : "New Daily Plan"
        }
        maxWidthClass="max-w-md"
      >
        {planModal?.kind === "daily" ? (
          <>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Under Weekly Focus
                </label>
                <select
                  value={dailyForm.weeklyItemId || ""}
                  onChange={(e) =>
                    setDailyForm((f) => ({
                      ...f,
                      weeklyItemId: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                >
                  {weeklyPlans.map((w) => (
                    <option key={w.id} value={w.id}>
                      W{w.week_number ?? 1}: {w.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Task / Daily Plan
                </label>
                <input
                  value={dailyForm.title}
                  onChange={(e) =>
                    setDailyForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Concrete Action For Today Or This Block"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </div>
            </div>
            <ApprovalFooter
              onCancel={() => setPlanModal(null)}
              onConfirm={savePlanModal}
              confirmText={
                planSubmitting
                  ? planModal.item
                    ? "Saving..."
                    : "Adding..."
                  : planModal.item
                    ? "Save"
                    : "Add"
              }
              confirmDisabled={planSubmitting}
            />
          </>
        ) : null}
      </ModalLayout>

      <ModalLayout
        isOpen={planModal?.kind === "department_kr"}
        onClose={() => setPlanModal(null)}
        title={
          planModal?.kind === "department_kr" && planModal.item
            ? "Edit Department Key Result"
            : "New Department Key Result"
        }
        maxWidthClass="max-w-lg"
      >
        {planModal?.kind === "department_kr" ? (
          <>
            {(() => {
              const objective = objectiveById.get(planModal.objectiveId);
              const parentMetric =
                companyKrMetricMap[objective?.company_kr_id ?? 0] ?? undefined;
              return parentMetric?.metricDefinitionId != null ? (
                <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 ring-1 ring-blue-100">
                  Metric is aligned to parent company KR:{" "}
                  <strong>
                    {parentMetric.metricName ?? "Required metric"}
                  </strong>
                  .
                </p>
              ) : null;
            })()}
            <p className="text-xs text-gray-500 mb-3">
              This key result belongs to{" "}
              <span className="font-medium text-gray-800">
                {objectiveById.get(planModal.objectiveId)?.title ??
                  "this objective"}
              </span>
              . You can use a single key result to work directly on the
              objective, or add multiple to break it down into smaller outcomes.
              Your plans and progress will be organized under these key results.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Title
                </label>
                <input
                  value={deptKrForm.title}
                  onChange={(e) =>
                    setDeptKrForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Measurable Department Sub-Outcome"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Description
                </label>
                <BulletTextarea
                  value={deptKrForm.description}
                  onValueChange={(value) =>
                    setDeptKrForm((f) => ({
                      ...f,
                      description: value,
                    }))
                  }
                  placeholder="How Success Is Defined"
                  className="min-h-[88px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Metric Definition
                  </label>
                  <select
                    value={deptKrForm.metricDefinitionId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const selectedMetric = metricDefinitions.find(
                        (m) => String(m.id) === val,
                      );
                      setDeptKrForm((f) => ({
                        ...f,
                        metricDefinitionId: val,
                        unitOfMeasure:
                          selectedMetric?.unit_of_measure ?? f.unitOfMeasure,
                      }));
                    }}
                    disabled={
                      companyKrMetricMap[
                        objectiveById.get(planModal.objectiveId)
                          ?.company_kr_id ?? 0
                      ]?.metricDefinitionId != null
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 bg-white disabled:bg-slate-50 disabled:text-gray-500"
                  >
                    <option value="">Select a Metric...</option>
                    {metricDefinitions.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Unit of Measure
                  </label>
                  <input
                    value={deptKrForm.unitOfMeasure}
                    onChange={(e) =>
                      setDeptKrForm((f) => ({
                        ...f,
                        unitOfMeasure: e.target.value,
                      }))
                    }
                    placeholder="e.g. ETB, %, count"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Weight (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={deptKrForm.weightPercent}
                    onChange={(e) =>
                      setDeptKrForm((f) => ({
                        ...f,
                        weightPercent: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Target Value
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={deptKrForm.targetValue}
                    onChange={(e) =>
                      setDeptKrForm((f) => ({
                        ...f,
                        targetValue: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">
                  Assigned Employees
                </label>
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/25"
                  />
                </div>
                <div className="max-h-40 overflow-auto rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                  {teamMembers.filter(tm => 
                    tm.employee.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) || 
                    tm.jobTitle.title.toLowerCase().includes(employeeSearch.toLowerCase())
                  ).length === 0 ? (
                    <p className="text-xs text-gray-500 italic">
                      No matching team members.
                    </p>
                  ) : (
                    teamMembers.filter(tm => 
                      tm.employee.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) || 
                      tm.jobTitle.title.toLowerCase().includes(employeeSearch.toLowerCase())
                    ).map((tm) => {
                      const userId = tm.employee.id; // Use Employee ID String for assignment
                      const checked = (
                        deptKrForm.assignedEmployeeIds || []
                      ).includes(userId);
                      return (
                        <label
                          key={userId}
                          className="flex cursor-pointer items-center gap-2 rounded p-1 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setDeptKrForm((f) => ({
                                ...f,
                                assignedEmployeeIds: e.target.checked
                                  ? [...(f.assignedEmployeeIds || []), userId]
                                  : (f.assignedEmployeeIds || []).filter(
                                      (id) => id !== userId,
                                    ),
                              }));
                            }}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {tm.employee.full_name}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {tm.jobTitle.title}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                {/*<p className="mt-2 text-[10px] text-gray-500">
                  Assigning an employee will create a corresponding objective
                  for them once the department plan is published.
                </p>*/}
              </div>
            </div>
            <ApprovalFooter
              onCancel={() => setPlanModal(null)}
              onConfirm={() => void saveDepartmentKrModal()}
              confirmText={
                planSubmitting
                  ? planModal.item
                    ? "Saving..."
                    : "Creating..."
                  : planModal.item
                    ? "Save"
                    : "Create"
              }
              confirmDisabled={planSubmitting}
            />
          </>
        ) : null}
      </ModalLayout>
    </Layout>
  );
}
