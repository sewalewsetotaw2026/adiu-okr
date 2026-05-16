import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiX, FiMaximize2, FiMinimize2 } from "react-icons/fi";
import { MdCheck, MdAdd, MdDelete } from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import Toggle from "../../../components/Core/ui/Toggle";
import {
  createWeeklyPlan,
  fetchMetricDefinitions,
  fetchWeeklyAvailableWeight,
  fetchMonthlyPlans,
  fetchManagerWeeklyPlans,
  checkManagerPlanExists,
} from "../../../services/okr-execution.api";
import {
  APPROVAL_GUARD_MESSAGE,
  getPlanCreationErrorMessage,
} from "./planCreationErrors";
import type {
  AvailableWeight,
  MetricDefinition,
  MonthlyPlan,
  WeeklyPlan,
} from "../../../../types/okr.types";

/**
 * 2-step modal for creating weekly plans.
 */

export interface AddWeeklyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  krIds: string[];
  onCreated: (plans: WeeklyPlan[]) => void;
  preselectedWeekNumber?: number;
  weeksInMonth?: number;
  userRoleLevel?: "CEO" | "DIRECTOR" | "MANAGER_TEAM_LEADER" | "EMPLOYEE";
  cycleId?: string | number | null;
  /** Level-based cadence configuration for all roles. */
  levelConfig?: Record<
    string,
    { allow_monthly: boolean; allow_weekly: boolean; allow_daily: boolean }
  > | null;
}

type Step = 1 | 2;

const TITLE_MAX = 150;
type ViewMode = "compact" | "full";
const VIEW_MODE_STORAGE_KEY = "okr-weekly-plan-modal-view-mode";

interface SubtaskForm {
  id: string;
  weekNumber: number | "";
  title: string;
  weight: string;
  metricDefinitionId: number | "";
  startValue: string;
  targetValue: string;
  contributeToScore: boolean;
  contributeToValue: boolean;
  alignedManagerPlanId: string | number | "";
}

function makeSubtask(defaultWeight?: string | number): SubtaskForm {
  return {
    id: Math.random().toString(36).slice(2),
    weekNumber: "",
    title: "",
    weight: defaultWeight != null ? String(defaultWeight) : "",
    metricDefinitionId: "",
    startValue: "0",
    targetValue: "",
    contributeToScore: true,
    contributeToValue: true,
    alignedManagerPlanId: "",
  };
}

export default function AddWeeklyPlanModal({
  isOpen,
  onClose,
  krIds,
  onCreated,
  preselectedWeekNumber,
  userRoleLevel,
  levelConfig,
}: AddWeeklyPlanModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "full"
        ? "full"
        : "compact";
    } catch {
      return "compact";
    }
  });
  const [isMounted, setIsMounted] = useState(false);
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([]);
  const [allocations, setAllocations] = useState<
    Record<string, AvailableWeight | null>
  >({});
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [selectedMonthlyId, setSelectedMonthlyId] = useState<string | null>(
    null,
  );
  const [subtasks, setSubtasks] = useState<SubtaskForm[]>([makeSubtask()]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [managerWeeklyPlans, setManagerWeeklyPlans] = useState<WeeklyPlan[]>(
    [],
  );
  const [loadingManagerWeekly, setLoadingManagerWeekly] = useState(false);
  const [managerHasPlan, setManagerHasPlan] = useState(false);
  const [checkingManagerPlan, setCheckingManagerPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const candidates = useMemo(
    () =>
      monthlyPlans.filter((mp) => {
        if (mp.plan_status !== "PUBLISHED") return false;
        const aw = allocations[mp.id];
        return !aw || aw.remaining_pct > 0;
      }),
    [monthlyPlans, allocations],
  );

  const selectedPlan = useMemo(
    () => monthlyPlans.find((p) => p.id === selectedMonthlyId) ?? null,
    [monthlyPlans, selectedMonthlyId],
  );
  const selectedAW = selectedMonthlyId ? allocations[selectedMonthlyId] : null;
  const remainingPct = selectedAW?.remaining_pct ?? 0;
  const allocatedPct = selectedAW?.allocated_pct ?? 0;

  const totalSubtaskWeight = useMemo(() => {
    return subtasks.reduce(
      (s, st) =>
        s +
        (Number.isFinite(Number(st.weight)) && Number(st.weight) > 0
          ? Number(st.weight)
          : 0),
      0,
    );
  }, [subtasks]);

  const canAddSubtask = totalSubtaskWeight < remainingPct;

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setIsMounted(true), 50);
      return () => clearTimeout(t);
    }
    setIsMounted(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSelectedMonthlyId(null);
    const first = makeSubtask();
    if (preselectedWeekNumber) first.weekNumber = preselectedWeekNumber;
    setSubtasks([first]);
    setError(null);
    setFieldErrors({});
    setSubmitting(false);
  }, [isOpen, preselectedWeekNumber]);

  useEffect(() => {
    if (!isOpen || !krIds.length) return;
    let cancelled = false;
    setLoadingMonthly(true);
    Promise.all(
      krIds.map((id) => fetchMonthlyPlans(id).catch(() => [] as MonthlyPlan[])),
    ).then((results) => {
      if (cancelled) return;
      const allPlans = results.flat();
      const seen = new Set<string>();
      const unique = allPlans.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      setMonthlyPlans(unique);
      setLoadingMonthly(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, krIds]);

  useEffect(() => {
    if (!monthlyPlans.length) return;
    let cancelled = false;
    Promise.all(
      monthlyPlans.map(async (mp) => {
        try {
          return [mp.id, await fetchWeeklyAvailableWeight(mp.id)] as const;
        } catch {
          return [mp.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setAllocations(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [monthlyPlans]);

  useEffect(() => {
    if (!isOpen) return;
    fetchMetricDefinitions().then(setMetrics).catch(console.error);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedPlan?.id) {
      setManagerWeeklyPlans([]);
      return;
    }

    setLoadingManagerWeekly(true);
    fetchManagerWeeklyPlans(
      String(selectedPlan.id),
      Number(preselectedWeekNumber),
    )

      .then(setManagerWeeklyPlans)
      .catch(() => setManagerWeeklyPlans([]))
      .finally(() => setLoadingManagerWeekly(false));
  }, [isOpen, selectedPlan?.aligned_manager_plan_id]);

  // Check if manager has weekly plans (for required alignment validation)
  useEffect(() => {
    if (!isOpen || !selectedPlan?.id || !preselectedWeekNumber) {
      setManagerHasPlan(false);
      return;
    }
    setCheckingManagerPlan(true);
    checkManagerPlanExists({
      cadence: "weekly",
      monthlyPlanId: String(selectedPlan.id),
      weekNumber: Number(preselectedWeekNumber),
    })
      .then((result) => {
        setManagerHasPlan(result.exists);
      })
      .catch(() => setManagerHasPlan(false))
      .finally(() => setCheckingManagerPlan(false));
  }, [isOpen, selectedPlan?.id, preselectedWeekNumber]);

  const updateSubtask = (id: string, patch: Partial<SubtaskForm>) =>
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );

  const handleSelectPlan = (id: string) => {
    setSelectedMonthlyId(id);
    const remaining = allocations[id]?.remaining_pct ?? 100;
    setSubtasks([makeSubtask(remaining)]);
    setStep(2);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    subtasks.forEach((st, i) => {
      const pfx = `st${i}_`;
      if (!st.title.trim()) errs[`${pfx}title`] = "Title is required.";
      if (st.title.length > TITLE_MAX)
        errs[`${pfx}title`] = `Max ${TITLE_MAX} chars.`;
      if (!st.weekNumber) errs[`${pfx}week`] = "Select a week.";
      const w = Number(st.weight);
      if (!Number.isFinite(w) || w <= 0)
        errs[`${pfx}weight`] = "Enter weight > 0.";

      // Check alignment is required when manager has a weekly plan
      if (managerHasPlan && !st.alignedManagerPlanId) {
        errs[`${pfx}alignment`] = "Please select your manager's weekly plan to align with.";
      }

      if (selectedPlan && st.targetValue !== "") {
        const tv = Number(st.targetValue);
        const pT = Number(selectedPlan.target_value ?? 0);
        const pS = Number(selectedPlan.start_value ?? 0);
        if (tv > pT)
          errs[`${pfx}targetValue`] = `Exceeds monthly plan target (${pT}).`;
        if (st.startValue !== "" && Number(st.startValue) < pS)
          errs[`${pfx}startValue`] = `Below plan start (${pS}).`;
        if (st.startValue !== "" && Number(st.startValue) > tv)
          errs[`${pfx}startValue`] = "Start cannot exceed target.";
      }
    });
    if (totalSubtaskWeight > remainingPct)
      errs["totalWeight"] =
        `Total ${totalSubtaskWeight}% exceeds available ${remainingPct}%.`;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSave = async () => {
    if (!selectedMonthlyId || !validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      const selectedMonthlyStatus = String(
        selectedPlan?.plan_status ?? (selectedPlan as any)?.status_code ?? "",
      ).toLowerCase();
      const parentKrStatus = String(
        (selectedPlan as any)?.parent_key_result?.status_code ?? "",
      ).toLowerCase();
      const isApproved = (status: string) =>
        !status || ["approved", "published", "closed"].includes(status);

      if (!isApproved(selectedMonthlyStatus) || !isApproved(parentKrStatus)) {
        setError(APPROVAL_GUARD_MESSAGE);
        return;
      }

      const created: WeeklyPlan[] = [];
      for (const st of subtasks) {
        const weight = Number(st.weight);
        created.push(
          await createWeeklyPlan(selectedMonthlyId, {
            week_number: st.weekNumber as 1 | 2 | 3 | 4 | 5,
            weight_pct: weight,
            adoption_mode: weight === 100 ? "direct" : "decomposed",
            title: st.title.trim(),
            metric_definition_id: st.metricDefinitionId
              ? Number(st.metricDefinitionId)
              : undefined,
            start_value:
              st.startValue !== "" ? Number(st.startValue) : undefined,
            target_value:
              st.targetValue !== "" ? Number(st.targetValue) : undefined,
            contribute_to_score: st.contributeToScore,
            contribute_to_value: st.contributeToValue,
            aligned_manager_plan_id: st.alignedManagerPlanId
              ? Number(st.alignedManagerPlanId)
              : undefined,
          }),
        );
        console.log("Submitting week:", st.weekNumber, Number(st.weekNumber));
      }
      onCreated(created);
      onClose();
    } catch (err: any) {
      setError(
        getPlanCreationErrorMessage(
          err,
          "Could not create plan(s). Try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === "compact" ? "full" : "compact";
      try {
        localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
      } catch { }
      return next;
    });
  };

  const canProceed = !!selectedMonthlyId;
  const canSave =
    canProceed &&
    subtasks.every((st) => st.title.trim() && st.weekNumber !== "") &&
    totalSubtaskWeight > 0 &&
    totalSubtaskWeight <= remainingPct;

  if (!isOpen) return null;
  const isFullView = viewMode === "full";
  const tc = isMounted ? "transition-all duration-300" : "";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm ${tc} ${isFullView ? "p-2" : "p-4"}`}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden ${tc} ${isFullView ? "max-w-6xl h-[96vh]" : "max-w-2xl h-[92vh]"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-0.5">
              {isFullView ? "Full View" : `Step ${step} of 2`}
            </div>
            <h3 className="text-lg font-bold text-slate-900 truncate">
              {step === 1 ? "Select Monthly Plan" : "Configure Weekly Plans"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleViewMode}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {isFullView ? (
                <FiMinimize2 size={16} />
              ) : (
                <FiMaximize2 size={16} />
              )}
              <span className="hidden sm:inline">
                {isFullView ? "Compact" : "Full View"}
              </span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Step bar */}
        <div className="px-6 pt-3 flex items-center gap-2">
          {[1, 2].map((n) => (
            <button
              key={n}
              onClick={() => {
                if (n === 1) setStep(1);
                if (n === 2 && canProceed) setStep(2);
              }}
              disabled={n === 2 && !canProceed}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${n <= step ? "bg-primary" : "bg-slate-100"}`}
              aria-label={`Go to step ${n}`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isFullView ? (
            <FullViewLayout
              candidates={candidates}
              loading={loadingMonthly}
              allocations={allocations}
              selectedId={selectedMonthlyId}
              onSelectPlan={handleSelectPlan}
              selectedPlan={selectedPlan}
              remainingPct={remainingPct}
              allocatedPct={allocatedPct}
              subtasks={subtasks}
              onUpdateSubtask={updateSubtask}
              onAddSubtask={() =>
                setSubtasks((p) => [
                  ...p,
                  makeSubtask(Math.max(0, remainingPct - totalSubtaskWeight)),
                ])
              }
              onRemoveSubtask={(id) =>
                setSubtasks((p) => p.filter((s) => s.id !== id))
              }
              canAddSubtask={canAddSubtask}
              totalSubtaskWeight={totalSubtaskWeight}
              metrics={metrics}
              fieldErrors={fieldErrors}
              error={error}
              preselectedWeekNumber={preselectedWeekNumber}
              selectedAW={selectedAW}
              managerWeeklyPlans={managerWeeklyPlans}
              loadingManagerWeekly={loadingManagerWeekly}
              managerHasPlan={managerHasPlan}
              checkingManagerPlan={checkingManagerPlan}
              userRoleLevel={userRoleLevel}
              levelConfig={levelConfig}
              setStep={setStep}
            />
          ) : (
            <>
              {step === 1 && (
                <Step1
                  candidates={candidates}
                  loading={loadingMonthly}
                  allocations={allocations}
                  selectedId={selectedMonthlyId}
                  onSelect={handleSelectPlan}
                />
              )}
              {step === 2 &&
                (selectedPlan ? (
                  <ConfigurePanel
                    plan={selectedPlan}
                    remainingPct={remainingPct}
                    allocatedPct={allocatedPct}
                    subtasks={subtasks}
                    onUpdateSubtask={updateSubtask}
                    onAddSubtask={() =>
                      setSubtasks((p) => [
                        ...p,
                        makeSubtask(Math.max(0, remainingPct - totalSubtaskWeight)),
                      ])
                    }
                    onRemoveSubtask={(id) =>
                      setSubtasks((p) => p.filter((s) => s.id !== id))
                    }
                    canAddSubtask={canAddSubtask}
                    totalSubtaskWeight={totalSubtaskWeight}
                    metrics={metrics}
                    fieldErrors={fieldErrors}
                    error={error}
                    preselectedWeekNumber={preselectedWeekNumber}
                    selectedAW={selectedAW}
                    managerWeeklyPlans={managerWeeklyPlans}
                    loadingManagerWeekly={loadingManagerWeekly}
                    managerHasPlan={managerHasPlan}
                    checkingManagerPlan={checkingManagerPlan}
                    userRoleLevel={userRoleLevel}
                    levelConfig={levelConfig}
                  />
                ) : null)}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3 bg-slate-50/40">
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => {
              if (step === 1 || isFullView) onClose();
              else setStep(1);
            }}
          >
            {step === 1 || isFullView ? "Cancel" : "← Back"}
          </Button>
          {isFullView || step === 2 ? (
            <Button
              variant="primary"
              size="sm"
              icon={MdCheck}
              onClick={() => void onSave()}
              loading={submitting}
              disabled={!canSave}
            >
              Save {subtasks.length > 1 ? `${subtasks.length} Plans` : "Plan"}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={!canProceed}
              onClick={() => setStep(2)}
            >
              Next →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Select Monthly Plan ───────────────────────────────────────────

function Step1({
  candidates,
  loading,
  allocations,
  selectedId,
  onSelect,
}: {
  candidates: MonthlyPlan[];
  loading: boolean;
  allocations: Record<string, AvailableWeight | null>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (loading)
    return (
      <div className="text-center py-8 text-sm text-slate-500">
        Loading monthly plans…
      </div>
    );
  if (candidates.length === 0)
    return (
      <div className="text-center py-10 px-4">
        <div className="text-base font-semibold text-slate-700 mb-1">
          Nothing available
        </div>
        <p className="text-sm text-slate-500">
          No published monthly plans with remaining capacity. Publish a monthly
          plan first.
        </p>
      </div>
    );

  return (
    <div className="space-y-3">
      {candidates.map((mp) => {
        const aw = allocations[mp.id];
        const allocated = aw?.allocated_pct ?? 0;
        const remaining = aw?.remaining_pct ?? 100;
        const progress = Math.max(
          0,
          Math.min(100, Number(mp.progress_pct ?? 0)),
        );
        const target = Number(mp.target_value ?? 0);
        const current = Number(mp.current_value ?? 0);
        const unit = mp.parent_key_result?.unit ?? "";
        const selected = mp.id === selectedId;

        return (
          <div key={mp.id}>
            <button
              type="button"
              onClick={() => onSelect(mp.id)}
              className={`w-full text-left rounded-2xl border p-4 transition-all ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                    Month {mp.month_number}
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 truncate">
                    {mp.title}
                  </h4>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                  Progress{" "}
                  <span className="text-primary tabular-nums">{progress}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mb-3">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="tabular-nums">
                  {current} / {target}
                  {unit ? ` ${unit}` : ""}
                </span>
                <span>
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {allocated}%
                  </span>{" "}
                  planned ·{" "}
                  <span className="font-semibold text-emerald-700 tabular-nums">
                    {remaining}%
                  </span>{" "}
                  remaining
                </span>
              </div>
              {aw &&
                aw.parent_target_value != null &&
                aw.parent_target_value > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 pt-1 border-t border-slate-100">
                    <span>
                      <span className="tabular-nums font-medium text-slate-500">
                        {aw.allocated_target_value ?? 0}
                      </span>{" "}
                      /{" "}
                      <span className="tabular-nums">
                        {aw.parent_target_value}
                      </span>
                      {unit ? ` ${unit}` : ""} allocated
                    </span>
                    <span>
                      <span className="tabular-nums font-semibold text-emerald-600">
                        {aw.remaining_target_value ?? 0}
                      </span>
                      {unit ? ` ${unit}` : ""} remaining
                    </span>
                  </div>
                )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Configure Panel (Step 2) ──────────────────────────────────────────────

function ConfigurePanel({
  plan,
  remainingPct,
  allocatedPct,
  subtasks,
  onUpdateSubtask,
  onAddSubtask,
  onRemoveSubtask,
  canAddSubtask,
  totalSubtaskWeight,
  metrics,
  fieldErrors,
  error,
  preselectedWeekNumber,
  selectedAW,
  managerWeeklyPlans,
  loadingManagerWeekly,
  managerHasPlan,
  checkingManagerPlan,
  userRoleLevel,
  levelConfig,
}: {
  plan: MonthlyPlan;
  remainingPct: number;
  allocatedPct: number;
  subtasks: SubtaskForm[];
  onUpdateSubtask: (id: string, p: Partial<SubtaskForm>) => void;
  onAddSubtask: () => void;
  onRemoveSubtask: (id: string) => void;
  canAddSubtask: boolean;
  totalSubtaskWeight: number;
  metrics: MetricDefinition[];
  fieldErrors: Record<string, string>;
  error: string | null;
  preselectedWeekNumber?: number;
  selectedAW?: AvailableWeight | null;
  managerWeeklyPlans: WeeklyPlan[];
  loadingManagerWeekly: boolean;
  managerHasPlan?: boolean;
  checkingManagerPlan?: boolean;
  userRoleLevel?: string;
  levelConfig?: Record<
    string,
    { allow_monthly: boolean; allow_weekly: boolean; allow_daily: boolean }
  > | null;
}) {
  const hasTargetInfo =
    selectedAW &&
    selectedAW.parent_target_value != null &&
    selectedAW.parent_target_value > 0;
  const unit = plan.parent_key_result?.unit ?? "";
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-100 px-4 py-3 text-xs flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="font-black tracking-widest uppercase text-[10px] text-slate-400 mr-1">
            Plan:
          </span>
          <span className="font-bold text-slate-800">
            M{plan.month_number} — {plan.title}
          </span>
        </span>
        <span>
          <span className="font-black tracking-widest uppercase text-[10px] text-slate-400 mr-1">
            Allocated:
          </span>
          <span className="font-semibold tabular-nums">{allocatedPct}%</span>
        </span>
        <span>
          <span className="font-black tracking-widest uppercase text-[10px] text-slate-400 mr-1">
            Remaining:
          </span>
          <span className="font-semibold text-emerald-700 tabular-nums">
            {remainingPct}%
          </span>
        </span>
      </div>
      {hasTargetInfo && (
        <div className="rounded-xl bg-emerald-50/60 ring-1 ring-inset ring-emerald-100 px-4 py-2 text-xs flex items-center justify-between">
          <span className="text-emerald-700">
            Target capacity:{" "}
            <strong className="tabular-nums">
              {selectedAW!.allocated_target_value ?? 0}
            </strong>{" "}
            /{" "}
            <strong className="tabular-nums">
              {selectedAW!.parent_target_value}
            </strong>
            {unit ? ` ${unit}` : ""} allocated
          </span>
          <span className="font-bold text-emerald-800 tabular-nums">
            {selectedAW!.remaining_target_value ?? 0}
            {unit ? ` ${unit}` : ""} remaining
          </span>
        </div>
      )}

      <div className="space-y-3">
        {subtasks.map((st, i) => (
          <SubtaskCard
            key={st.id}
            index={i}
            subtask={st}
            onUpdate={(p) => onUpdateSubtask(st.id, p)}
            onRemove={() => onRemoveSubtask(st.id)}
            canRemove={subtasks.length > 1}
            remainingPct={remainingPct}
            metrics={metrics}
            fieldErrors={fieldErrors}
            plan={plan}
            preselectedWeekNumber={preselectedWeekNumber}
            selectedAW={selectedAW}
            managerWeeklyPlans={
              st.weekNumber
                ? managerWeeklyPlans.filter(
                  (mp) => mp.week_number === st.weekNumber,
                )
                : []
            }
            loadingManagerWeekly={loadingManagerWeekly}
            managerHasPlan={managerHasPlan}
            checkingManagerPlan={checkingManagerPlan}
            userRoleLevel={userRoleLevel}
            levelConfig={levelConfig}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAddSubtask}
        disabled={!canAddSubtask}
        className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-2.5 text-sm font-semibold transition-colors ${canAddSubtask ? "border-primary/40 text-primary hover:bg-primary/5" : "border-slate-200 text-slate-300 cursor-not-allowed"}`}
      >
        <MdAdd size={18} /> Add Weekly Subtask
      </button>
      <div className="rounded-xl bg-primary/5 ring-1 ring-inset ring-primary/15 px-4 py-2.5 text-xs flex items-center justify-between">
        <span className="text-primary/80">Total allocated:</span>
        <span
          className={`font-bold tabular-nums ${totalSubtaskWeight > remainingPct ? "text-rose-600" : "text-primary"}`}
        >
          {totalSubtaskWeight}% / {remainingPct}%
        </span>
      </div>

      {fieldErrors["totalWeight"] && (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {fieldErrors["totalWeight"]}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}

function SubtaskCard({
  index,
  subtask,
  onUpdate,
  onRemove,
  canRemove,
  remainingPct,
  metrics,
  fieldErrors,
  preselectedWeekNumber,
  plan,
  selectedAW,
  managerWeeklyPlans,
  loadingManagerWeekly,
  managerHasPlan,
  checkingManagerPlan,
  userRoleLevel,
  levelConfig,
}: {
  index: number;
  subtask: SubtaskForm;
  onUpdate: (fields: Partial<SubtaskForm>) => void;
  onRemove: () => void;
  canRemove: boolean;
  remainingPct: number;
  metrics: MetricDefinition[];
  fieldErrors: Record<string, string>;
  preselectedWeekNumber?: string | number;
  plan?: any;
  selectedAW?: any;
  managerWeeklyPlans?: any[];
  loadingManagerWeekly?: boolean;
  managerHasPlan?: boolean;
  checkingManagerPlan?: boolean;
  userRoleLevel?: string;
  levelConfig?: any;
}) {
  const selectedMetric = metrics.find(
    (m) => m.id === subtask.metricDefinitionId,
  );
  const hideValues =
    selectedMetric?.category === "MILESTONE" ||
    selectedMetric?.category === "RATING" ||
    selectedMetric?.category === "CUSTOM" ||
    !!selectedMetric?.allows_binary_completion;
  const weight = Number(subtask.weight) || 0;
  const pfx = `st${index}_`;
  const remainingTarget = selectedAW?.remaining_target_value ?? 0;
  const autoTarget =
    remainingPct > 0 && remainingTarget > 0 && weight > 0
      ? Number(((remainingTarget * weight) / remainingPct).toFixed(2))
      : 0;

  useEffect(() => {
    if (preselectedWeekNumber && subtask.weekNumber === "")
      onUpdate({ weekNumber: Number(preselectedWeekNumber) });
  }, []);

  useEffect(() => {
    if (!metrics.length || subtask.metricDefinitionId !== "") return;
    const u = plan.parent_key_result?.unit ?? "";
    if (!u) return;
    const match = metrics.find(
      (m) =>
        (m.unit_of_measure ?? m.unit ?? "").toLowerCase() === u.toLowerCase(),
    );
    if (match) onUpdate({ metricDefinitionId: match.id });
  }, [metrics]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">
          Subtask {index + 1}
          {weight > 0 && (
            <span className="ml-2 text-xs font-normal text-primary/70">
              ({weight}% of plan)
            </span>
          )}
        </span>
        {canRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <MdDelete size={16} />
          </button>
        )}
      </div>

      <Field label="Week" required error={fieldErrors[`${pfx}week`]}>
        {(() => {
          const availableWeeks = selectedAW?.weeks || [];
          const weekNumbers = [1, 2, 3, 4, 5].filter((w) =>
            availableWeeks.some(
              (aw: any) =>
                aw.week_number === w &&
                (aw.plan_id === null || subtask.weekNumber === w),
            ),
          );
          return (
            <select
              value={subtask.weekNumber}
              onChange={(e) =>
                onUpdate({
                  weekNumber:
                    e.target.value === "" ? "" : Number(e.target.value),
                })
              }
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Week…</option>
              {weekNumbers.map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          );
        })()}
      </Field>

      <Field label="Title" required error={fieldErrors[`${pfx}title`]}>
        <input
          value={subtask.title}
          maxLength={TITLE_MAX}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="e.g. Complete feature spec review"
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <div className="text-[10px] text-slate-400 mt-0.5 text-right">
          {subtask.title.length}/{TITLE_MAX}
        </div>
      </Field>

      <Field
        label={`Align with Manager Weekly Plan${managerHasPlan ? " *" : ""}`}
        error={fieldErrors[`${pfx}alignment`]}
      >
        {(() => {
          // Determine the manager's role level (one level up in the hierarchy)
          const ROLE_HIERARCHY: string[] = [
            "EMPLOYEE",
            "MANAGER_TEAM_LEADER",
            "DIRECTOR",
            "CEO",
          ];
          const currentIdx = ROLE_HIERARCHY.indexOf(
            userRoleLevel || "EMPLOYEE",
          );
          const managerRole =
            currentIdx >= 0 && currentIdx < ROLE_HIERARCHY.length - 1
              ? ROLE_HIERARCHY[currentIdx + 1]
              : null;

          // Check if the manager's cadence config enables weekly planning
          const managerCadence =
            managerRole && levelConfig ? levelConfig[managerRole] : null;
          const managerAllowsWeekly = managerCadence
            ? managerCadence.allow_weekly
            : true;

          if (loadingManagerWeekly || checkingManagerPlan) {
            return (
              <div className="animate-pulse h-10 bg-slate-100 rounded-xl" />
            );
          }
          if (!plan.aligned_manager_plan_id && (!managerWeeklyPlans || managerWeeklyPlans.length === 0)) {
            return (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500">
                  This monthly plan is not aligned with any manager plan, and no
                  manager plans were found for this period.
                </p>
              </div>
            );
          }

          if (userRoleLevel === "DIRECTOR" || userRoleLevel === "CEO") {
            return (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-[10px] text-slate-500 italic">
                Alignment is managed at the quarterly objective level for
                Department Managers.
              </div>
            );
          }
          if (!managerAllowsWeekly) {
            return (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500 italic">
                  Weekly alignment is not applicable — your manager's planning
                  cadence does not include weekly plans.
                </p>
              </div>
            );
          }
          if (managerWeeklyPlans && managerWeeklyPlans.length > 0) {
            return (
              <>
                {managerHasPlan && (
                  <p className="text-[10px] text-amber-600 mb-1.5">
                    Your manager has a Weekly plan. You must align with it.
                  </p>
                )}
                <select
                  value={subtask.alignedManagerPlanId}
                  onChange={(e) =>
                    onUpdate({ alignedManagerPlanId: e.target.value })
                  }
                  className={`w-full bg-white border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ${fieldErrors[`${pfx}alignment`] ? "border-rose-300 focus:ring-rose-100" : "border-slate-200 focus:border-primary focus:ring-primary/20"}`}
                  required={managerHasPlan}
                >
                  <option value="">{managerHasPlan ? "Required: Select manager plan…" : "Align to manager…"}</option>
                  {managerWeeklyPlans.map((wp: any) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.title}
                    </option>
                  ))}
                </select>
              </>
            );
          }
          return (
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-2 text-[10px] text-amber-700 flex items-center gap-2">
              <span>⚠️</span> Manager hasn't planned this week.
            </div>
          );
        })()}
      </Field>

      <Field label="Weight (%)" required error={fieldErrors[`${pfx}weight`]}>
        <input
          type="number"
          value={subtask.weight}
          min={1}
          max={remainingPct}
          onChange={(e) => onUpdate({ weight: e.target.value })}
          placeholder={`Max: ${remainingPct}%`}
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Metric Definition">
          <select
            value={subtask.metricDefinitionId}
            onChange={(e) =>
              onUpdate({
                metricDefinitionId:
                  e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Auto-inherit</option>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.unit_of_measure || m.unit
                  ? ` (${m.unit_of_measure || m.unit})`
                  : ""}
              </option>
            ))}
          </select>
        </Field>
        {!hideValues && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start Value" error={fieldErrors[`${pfx}startValue`]}>
              <input
                type="number"
                value={subtask.startValue}
                onChange={(e) => onUpdate({ startValue: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </Field>
            <Field
              label="Target Value"
              error={fieldErrors[`${pfx}targetValue`]}
            >
              <input
                type="number"
                value={subtask.targetValue}
                onChange={(e) => onUpdate({ targetValue: e.target.value })}
                placeholder={
                  autoTarget ? "Auto: " + autoTarget.toFixed(2) : "Target"
                }
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="pt-2 flex flex-col gap-2">
        {!selectedMetric?.value_based_progress && (
          <Toggle
            label="Contribute to Score"
            description="Task completion affects overall plan score"
            checked={subtask.contributeToScore}
            onChange={(val: boolean) => onUpdate({ contributeToScore: val })}
          />
        )}
        {!selectedMetric?.is_financial && (
          <Toggle
            label="Contribute to Value"
            description="Update progress affects the parent value"
            checked={subtask.contributeToValue}
            onChange={(val: boolean) => onUpdate({ contributeToValue: val })}
          />
        )}
      </div>
    </div>
  );
}

// ── Full View Layout (2:3 split) ──────────────────────────────────────────

function FullViewLayout({
  candidates,
  loading,
  allocations,
  selectedId,
  onSelectPlan,
  selectedPlan,
  remainingPct,
  allocatedPct,
  subtasks,
  onUpdateSubtask,
  onAddSubtask,
  onRemoveSubtask,
  canAddSubtask,
  totalSubtaskWeight,
  metrics,
  fieldErrors,
  error,
  preselectedWeekNumber,
  setStep,
  selectedAW,
  managerWeeklyPlans,
  loadingManagerWeekly,
  managerHasPlan,
  checkingManagerPlan,
  userRoleLevel,
  levelConfig,
}: {
  candidates: MonthlyPlan[];
  loading: boolean;
  allocations: Record<string, AvailableWeight | null>;
  selectedId: string | null;
  onSelectPlan: (id: string) => void;
  selectedPlan: MonthlyPlan | null;
  remainingPct: number;
  allocatedPct: number;
  subtasks: SubtaskForm[];
  onUpdateSubtask: (id: string, p: Partial<SubtaskForm>) => void;
  onAddSubtask: () => void;
  onRemoveSubtask: (id: string) => void;
  canAddSubtask: boolean;
  totalSubtaskWeight: number;
  metrics: MetricDefinition[];
  fieldErrors: Record<string, string>;
  error: string | null;
  preselectedWeekNumber?: number;
  setStep: (s: Step) => void;
  selectedAW: AvailableWeight | null;
  managerWeeklyPlans: WeeklyPlan[];
  loadingManagerWeekly: boolean;
  managerHasPlan?: boolean;
  checkingManagerPlan?: boolean;
  userRoleLevel?: string;
  levelConfig?: Record<
    string,
    { allow_monthly: boolean; allow_weekly: boolean; allow_daily: boolean }
  > | null;
}) {
  const step1Done = !!selectedId;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
      {/* Left: Select Plan (2/5) */}
      <div
        className={`lg:col-span-2 flex flex-col gap-3 ${step1Done ? "opacity-90" : ""}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step1Done ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}
          >
            {step1Done ? "✓" : "1"}
          </div>
          <h4 className="font-bold text-slate-800 text-sm">Select Plan</h4>
        </div>
        <div className="flex-1 bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="h-full overflow-y-auto p-3">
            <Step1
              candidates={candidates}
              loading={loading}
              allocations={allocations}
              selectedId={selectedId}
              onSelect={(id) => {
                onSelectPlan(id);
                setStep(2);
              }}
            />
          </div>
        </div>
      </div>

      {/* Right: Configure (3/5) */}
      <div
        className={`lg:col-span-3 flex flex-col gap-3 transition-all duration-300 ${!step1Done ? "opacity-40 pointer-events-none" : ""}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step1Done ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-400"}`}
          >
            2
          </div>
          <h4 className="font-bold text-slate-800 text-sm">Configure Plans</h4>
        </div>
        <div className="flex-1 bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="h-full overflow-y-auto p-4">
            {selectedPlan ? (
              <ConfigurePanel
                plan={selectedPlan}
                remainingPct={remainingPct}
                allocatedPct={allocatedPct}
                subtasks={subtasks}
                onUpdateSubtask={onUpdateSubtask}
                onAddSubtask={onAddSubtask}
                onRemoveSubtask={onRemoveSubtask}
                canAddSubtask={canAddSubtask}
                totalSubtaskWeight={totalSubtaskWeight}
                metrics={metrics}
                fieldErrors={fieldErrors}
                error={error}
                preselectedWeekNumber={preselectedWeekNumber}
                selectedAW={selectedAW}
                managerWeeklyPlans={managerWeeklyPlans}
                loadingManagerWeekly={loadingManagerWeekly}
                managerHasPlan={managerHasPlan}
                checkingManagerPlan={checkingManagerPlan}
                userRoleLevel={userRoleLevel}
                levelConfig={levelConfig}
              />
            ) : (
              <div className="text-center py-8 text-sm text-slate-400">
                Select a monthly plan first
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold tracking-wide uppercase text-slate-500 mb-1.5 inline-block">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <div className="text-[11px] text-rose-600 mt-1 font-medium">
          {error}
        </div>
      )}
    </div>
  );
}
