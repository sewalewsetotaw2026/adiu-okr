import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiX, FiMaximize2, FiMinimize2 } from "react-icons/fi";
import { MdCheck, MdAdd, MdDelete } from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import {
  createMonthlyPlan,
  fetchMetricDefinitions,
  fetchMonthlyAvailableWeight,
  fetchManagerMonthlyPlans,
} from "../../../services/okr-execution.api";
import BulletTextarea from "../../../components/common/BulletTextarea";
import type {
  AvailableWeight,
  MetricDefinition,
  MonthlyPlan,
} from "../../../../types/okr.types";

/**
 * 2-step modal for creating monthly plans.
 *
 * Step 1 — Select a Key Result
 * Step 2 — Configure Plan with multi-subtask list
 */

export interface AddMonthlyKR {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  start_value?: number;
  progress_pct: number;
  unit?: string;
}

export interface AddMonthlyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  krs: AddMonthlyKR[];
  onCreated: (plans: MonthlyPlan[]) => void;
  preselectedMonth?: 1 | 2 | 3;
  cycleId?: string | number;
  userRoleLevel?: "CEO" | "DIRECTOR" | "MANAGER_TEAM_LEADER" | "EMPLOYEE";
}

type Step = 1 | 2;

const ALL_MONTHS: (1 | 2 | 3)[] = [1, 2, 3];
const TITLE_MAX = 150;
type ViewMode = "compact" | "full";
const VIEW_MODE_STORAGE_KEY = "okr-monthly-plan-modal-view-mode";

interface SubtaskForm {
  id: string;
  monthNumber: 1 | 2 | 3 | "";
  title: string;
  description: string;
  weight: string;
  metricDefinitionId: number | "";
  startValue: string;
  targetValue: string;
  contributeToScore: boolean;
  contributeToValue: boolean;
  alignedManagerPlanId: string | number | "";
}

function makeSubtask(): SubtaskForm {
  return {
    id: Math.random().toString(36).slice(2),
    monthNumber: "",
    title: "",
    description: "",
    weight: "",
    metricDefinitionId: "",
    startValue: "0",
    targetValue: "",
    contributeToScore: true,
    contributeToValue: true,
    alignedManagerPlanId: "",
  };
}

export default function AddMonthlyPlanModal({
  isOpen,
  onClose,
  krs,
  onCreated,
  preselectedKrId,
  preselectedMonth,
  cycleId,
  userRoleLevel,
}: AddMonthlyPlanModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "full" ? "full" : "compact"; }
    catch { return "compact"; }
  });
  const [isMounted, setIsMounted] = useState(false);
  const [krWeights, setKrWeights] = useState<Record<string, AvailableWeight | null>>({});
  const [loadingWeights, setLoadingWeights] = useState(false);
  const [selectedKrId, setSelectedKrId] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<SubtaskForm[]>([makeSubtask()]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [managerPlans, setManagerPlans] = useState<Record<number, MonthlyPlan[]>>({});
  const [loadingManagerPlans, setLoadingManagerPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const visibleKrs = useMemo(() =>
    krs.filter((kr) => {
      const aw = krWeights[kr.id];
      return aw && aw.remaining_pct > 0 && Number(kr.progress_pct ?? 0) < 100;
    }), [krs, krWeights]);

  const hasLoadFailures = useMemo(
    () => !loadingWeights && krs.some((kr) => krWeights[kr.id] === null),
    [krs, krWeights, loadingWeights]);

  const selectedKr = useMemo(() => krs.find((k) => k.id === selectedKrId) ?? null, [krs, selectedKrId]);
  const selectedAW = selectedKrId ? krWeights[selectedKrId] : null;
  const remainingPct = selectedAW?.remaining_pct ?? 0;
  const allocatedPct = selectedAW?.allocated_pct ?? 0;
  const totalSubtaskWeight = useMemo(() => {
    return subtasks.reduce((s, st) => s + (Number.isFinite(Number(st.weight)) && Number(st.weight) > 0 ? Number(st.weight) : 0), 0);
  }, [subtasks]);

  const canAddSubtask = totalSubtaskWeight < remainingPct;

  useEffect(() => {
    if (isOpen) { const t = setTimeout(() => setIsMounted(true), 50); return () => clearTimeout(t); }
    setIsMounted(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSelectedKrId(preselectedKrId ?? null);
    const first = makeSubtask();
    if (preselectedMonth) first.monthNumber = preselectedMonth;
    setSubtasks([first]);
    setError(null);
    setFieldErrors({});
    setSubmitting(false);
  }, [isOpen, preselectedKrId, preselectedMonth]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingWeights(true);
    Promise.all(krs.map(async (kr) => {
      try { return [kr.id, await fetchMonthlyAvailableWeight(kr.id)] as const; }
      catch { return [kr.id, null] as const; }
    })).then((entries) => {
      if (!cancelled) {
        setKrWeights(Object.fromEntries(entries));
        setLoadingWeights(false);
      }
    });
    return () => { cancelled = true; };
  }, [isOpen, krs]);

  useEffect(() => {
    if (!isOpen) return;
    fetchMetricDefinitions().then(setMetrics).catch(console.error);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !cycleId) return;
    setLoadingManagerPlans(true);
    Promise.all([1, 2, 3].map(m => 
      fetchManagerMonthlyPlans(m, String(cycleId)).catch(() => [])
    )).then(results => {
      setManagerPlans({
        1: results[0],
        2: results[1],
        3: results[2]
      });
    }).finally(() => setLoadingManagerPlans(false));
  }, [isOpen, cycleId]);


  const updateSubtask = (id: string, patch: Partial<SubtaskForm>) =>
    setSubtasks((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));

  const handleSelectKr = (id: string) => {
    setSelectedKrId(id);
    setStep(2);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    subtasks.forEach((st, i) => {
      const p = `st${i}_`;
      if (!st.title.trim()) errs[`${p}title`] = "Title is required.";
      if (st.title.length > TITLE_MAX) errs[`${p}title`] = `Max ${TITLE_MAX} chars.`;
      if (!st.monthNumber) errs[`${p}month`] = "Select a month.";
      const w = Number(st.weight);
      if (!Number.isFinite(w) || w <= 0) errs[`${p}weight`] = "Enter weight > 0.";
      
      if (selectedKr && st.targetValue !== "") {
        const tv = Number(st.targetValue);
        const krT = Number(selectedKr.target_value ?? 0);
        const krS = Number(selectedKr.start_value ?? 0);
        if (tv > krT) errs[`${p}targetValue`] = `Exceeds KR target (${krT}).`;
        if (st.startValue !== "" && Number(st.startValue) < krS) errs[`${p}startValue`] = `Below KR start (${krS}).`;
        if (st.startValue !== "" && Number(st.startValue) > tv) errs[`${p}startValue`] = "Start cannot exceed target.";
      }
    });
    if (totalSubtaskWeight > remainingPct)
      errs["totalWeight"] = `Total ${totalSubtaskWeight}% exceeds available ${remainingPct}%.`;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSave = async () => {
    if (!selectedKrId || !validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created: MonthlyPlan[] = [];
      for (const st of subtasks) {
        const weight = Number(st.weight);
        created.push(await createMonthlyPlan(selectedKrId, {
          month_number: st.monthNumber as 1 | 2 | 3,
          adoption_mode: weight === 100 ? "direct" : "decomposed",
          weight_pct: weight,
          title: st.title.trim(),
          description: st.description.trim() || undefined,
          metric_definition_id: st.metricDefinitionId ? Number(st.metricDefinitionId) : undefined,
          start_value: st.startValue !== "" ? Number(st.startValue) : undefined,
          target_value: st.targetValue !== "" ? Number(st.targetValue) : undefined,
          contribute_to_score: st.contributeToScore,
          contribute_to_value: st.contributeToValue,
          aligned_manager_plan_id: st.alignedManagerPlanId || undefined,
        }));
      }
      onCreated(created);
      onClose();
    } catch (err: any) {
      setError(err?.data?.message || err?.message || "Could not create plan(s). Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === "compact" ? "full" : "compact";
      try { localStorage.setItem(VIEW_MODE_STORAGE_KEY, next); } catch {}
      return next;
    });
  };

  const canProceed = !!selectedKrId;
  const canSave = canProceed && subtasks.every((st) => st.title.trim() && st.monthNumber !== "") &&
    (totalSubtaskWeight > 0 && totalSubtaskWeight <= remainingPct);

  if (!isOpen) return null;
  const isFullView = viewMode === "full";
  const tc = isMounted ? "transition-all duration-300" : "";

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm ${tc} ${isFullView ? "p-2" : "p-4"}`}
      role="dialog" aria-modal="true">
      <div className={`bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden ${tc} ${isFullView ? "max-w-6xl h-[96vh]" : "max-w-2xl h-[92vh]"}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-0.5">
              {isFullView ? "Full View" : `Step ${step} of 2`}
            </div>
            <h3 className="text-lg font-bold text-slate-900 truncate">
              {step === 1 ? "Select Key Result" : "Configure Monthly Plans"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleViewMode}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
              {isFullView ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
              <span className="hidden sm:inline">{isFullView ? "Compact" : "Full View"}</span>
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Step bar */}
        <div className="px-6 pt-3 flex items-center gap-2">
          {[1, 2].map((n) => (
            <button key={n}
              onClick={() => { if (n === 1) setStep(1); if (n === 2 && canProceed) setStep(2); }}
              disabled={n === 2 && !canProceed}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${n <= step ? "bg-primary" : "bg-slate-100"}`}
              aria-label={`Go to step ${n}`} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isFullView ? (
            <FullViewLayout
              krs={visibleKrs} loadingKrs={loadingWeights} hasLoadFailures={hasLoadFailures}
              krWeights={krWeights} selectedKrId={selectedKrId} onSelectKr={handleSelectKr}
              selectedKr={selectedKr} remainingPct={remainingPct} allocatedPct={allocatedPct}
              subtasks={subtasks} onUpdateSubtask={updateSubtask}
              onAddSubtask={() => setSubtasks((p) => [...p, makeSubtask()])}
              onRemoveSubtask={(id) => setSubtasks((p) => p.filter((s) => s.id !== id))}
              canAddSubtask={canAddSubtask} totalSubtaskWeight={totalSubtaskWeight}
              metrics={metrics} fieldErrors={fieldErrors} error={error}
              preselectedMonth={preselectedMonth} setStep={setStep} selectedAW={selectedAW}
              managerPlans={managerPlans}
              loadingManagerPlans={loadingManagerPlans}
              userRoleLevel={userRoleLevel}
            />
          ) : (
            <>
              {step === 1 && (
                <Step1
                  krs={visibleKrs} loading={loadingWeights} hasLoadFailures={hasLoadFailures}
                  krWeights={krWeights} selectedKrId={selectedKrId} onSelect={handleSelectKr}
                />
              )}
              {step === 2 && selectedKr && (
                <ConfigurePanel
                  kr={selectedKr} remainingPct={remainingPct}
                  allocatedPct={allocatedPct} subtasks={subtasks} onUpdateSubtask={updateSubtask}
                  onAddSubtask={() => setSubtasks((p) => [...p, makeSubtask()])}
                  onRemoveSubtask={(id) => setSubtasks((p) => p.filter((s) => s.id !== id))}
                  canAddSubtask={canAddSubtask} totalSubtaskWeight={totalSubtaskWeight}
                  metrics={metrics} fieldErrors={fieldErrors} error={error}
                  preselectedMonth={preselectedMonth} selectedAW={selectedAW}
                  managerPlans={managerPlans}
                  loadingManagerPlans={loadingManagerPlans}
                  userRoleLevel={userRoleLevel}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3 bg-slate-50/40">
          <Button variant="ghost" size="sm" disabled={submitting}
            onClick={() => { if (step === 1 || isFullView) onClose(); else setStep(1); }}>
            {step === 1 || isFullView ? "Cancel" : "← Back"}
          </Button>
          {isFullView || step === 2 ? (
            <Button variant="primary" size="sm" icon={MdCheck}
              onClick={() => void onSave()} loading={submitting} disabled={!canSave}>
              Save {subtasks.length > 1 ? `${subtasks.length} Plans` : "Plan"}
            </Button>
          ) : (
            <Button variant="primary" size="sm" disabled={!canProceed} onClick={() => setStep(2)}>
              Next →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Select KR ───────────────────────────────────────────────────

function Step1({
  krs, loading, hasLoadFailures, krWeights, selectedKrId, onSelect,
}: {
  krs: AddMonthlyKR[];
  loading: boolean;
  hasLoadFailures: boolean;
  krWeights: Record<string, AvailableWeight | null>;
  selectedKrId: string | null;
  onSelect: (id: string) => void;
}) {
  if (loading) return <div className="text-center py-8 text-sm text-slate-500">Loading key result allocations…</div>;
  if (krs.length === 0) return (
    <div className="text-center py-10 px-4">
      <div className="text-base font-semibold text-slate-700 mb-1">Nothing available</div>
      <p className="text-sm text-slate-500">
        {hasLoadFailures ? "Could not load allocation data. Try reopening." : "All Key Results are fully complete or planned."}
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {krs.map((kr) => {
        const aw = krWeights[kr.id];
        const allocated = aw?.allocated_pct ?? 0;
        const remaining = aw?.remaining_pct ?? 0;
        const progress = Math.max(0, Math.min(100, Number(kr.progress_pct ?? 0)));
        const selected = kr.id === selectedKrId;

        return (
          <div key={kr.id}>
            <button type="button" onClick={() => onSelect(kr.id)}
              className={`w-full text-left rounded-2xl border p-4 transition-all ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h4 className="text-sm font-bold text-slate-800 truncate">{kr.title}</h4>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                  Progress <span className="text-primary tabular-nums">{progress}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mb-3">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span><span className="font-semibold text-slate-700 tabular-nums">{allocated}%</span> planned</span>
                <span><span className="font-semibold text-emerald-700 tabular-nums">{remaining}%</span> remaining</span>
              </div>
              {aw && aw.parent_target_value != null && aw.parent_target_value > 0 && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 pt-1 border-t border-slate-100">
                  <span><span className="tabular-nums font-medium text-slate-500">{aw.allocated_target_value ?? 0}</span> / <span className="tabular-nums">{aw.parent_target_value}</span>{kr.unit ? ` ${kr.unit}` : ''} allocated</span>
                  <span><span className="tabular-nums font-semibold text-emerald-600">{aw.remaining_target_value ?? 0}</span>{kr.unit ? ` ${kr.unit}` : ''} remaining</span>
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
  kr, remainingPct, allocatedPct, subtasks, onUpdateSubtask,
  onAddSubtask, onRemoveSubtask, canAddSubtask, totalSubtaskWeight, metrics,
  fieldErrors, error, preselectedMonth, selectedAW, managerPlans, loadingManagerPlans,
  userRoleLevel,
}: {
  kr: AddMonthlyKR; remainingPct: number; allocatedPct: number;
  subtasks: SubtaskForm[]; onUpdateSubtask: (id: string, p: Partial<SubtaskForm>) => void;
  onAddSubtask: () => void; onRemoveSubtask: (id: string) => void; canAddSubtask: boolean;
  totalSubtaskWeight: number; metrics: MetricDefinition[]; fieldErrors: Record<string, string>;
  error: string | null; preselectedMonth?: 1 | 2 | 3; selectedAW?: AvailableWeight | null;
  managerPlans: Record<number, MonthlyPlan[]>;
  loadingManagerPlans: boolean;
  userRoleLevel?: string;
}) {
  const hasTargetInfo = selectedAW && selectedAW.parent_target_value != null && selectedAW.parent_target_value > 0;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-100 px-4 py-3 text-xs flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="font-black tracking-widest uppercase text-[10px] text-slate-400 mr-1">KR:</span><span className="font-bold text-slate-800">{kr.title}</span></span>
        <span><span className="font-black tracking-widest uppercase text-[10px] text-slate-400 mr-1">Allocated:</span><span className="font-semibold tabular-nums">{allocatedPct}%</span></span>
        <span><span className="font-black tracking-widest uppercase text-[10px] text-slate-400 mr-1">Remaining:</span><span className="font-semibold text-emerald-700 tabular-nums">{remainingPct}%</span></span>
      </div>
      {hasTargetInfo && (
        <div className="rounded-xl bg-emerald-50/60 ring-1 ring-inset ring-emerald-100 px-4 py-2 text-xs flex items-center justify-between">
          <span className="text-emerald-700">Target capacity: <strong className="tabular-nums">{selectedAW!.allocated_target_value ?? 0}</strong> / <strong className="tabular-nums">{selectedAW!.parent_target_value}</strong>{kr.unit ? ` ${kr.unit}` : ''} allocated</span>
          <span className="font-bold text-emerald-800 tabular-nums">{selectedAW!.remaining_target_value ?? 0}{kr.unit ? ` ${kr.unit}` : ''} remaining</span>
        </div>
      )}

      <div className="space-y-3">
        {subtasks.map((st, i) => (
          <SubtaskCard key={st.id} index={i} subtask={st}
            onUpdate={(p) => onUpdateSubtask(st.id, p)}
            onRemove={() => onRemoveSubtask(st.id)}
            canRemove={subtasks.length > 1}
            remainingPct={remainingPct}
            metrics={metrics} fieldErrors={fieldErrors} kr={kr}
            preselectedMonth={preselectedMonth} selectedAW={selectedAW}
            managerPlans={st.monthNumber ? (managerPlans[st.monthNumber as number] || []) : []}
            loadingManagerPlans={loadingManagerPlans}
            userRoleLevel={userRoleLevel}
          />
        ))}
      </div>

      <button type="button" onClick={onAddSubtask} disabled={!canAddSubtask}
        className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-2.5 text-sm font-semibold transition-colors ${canAddSubtask ? "border-primary/40 text-primary hover:bg-primary/5" : "border-slate-200 text-slate-300 cursor-not-allowed"}`}>
        <MdAdd size={18} /> Add Another Subtask
      </button>
      <div className="rounded-xl bg-primary/5 ring-1 ring-inset ring-primary/15 px-4 py-2.5 text-xs flex items-center justify-between">
        <span className="text-primary/80">Total allocated:</span>
        <span className={`font-bold tabular-nums ${totalSubtaskWeight > remainingPct ? "text-rose-600" : "text-primary"}`}>
          {totalSubtaskWeight}% / {remainingPct}%
        </span>
      </div>

      {fieldErrors["totalWeight"] && (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{fieldErrors["totalWeight"]}</div>
      )}
      {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
    </div>
  );
}

function SubtaskCard({
  index, subtask, onUpdate, onRemove, canRemove, remainingPct, metrics, fieldErrors, kr, preselectedMonth, selectedAW, managerPlans, loadingManagerPlans, userRoleLevel,
}: {
  index: number; subtask: SubtaskForm; onUpdate: (p: Partial<SubtaskForm>) => void; onRemove: () => void;
  canRemove: boolean; remainingPct: number; metrics: MetricDefinition[];
  fieldErrors: Record<string, string>; kr: AddMonthlyKR; preselectedMonth?: 1 | 2 | 3;
  selectedAW?: AvailableWeight | null;
  managerPlans: MonthlyPlan[];
  loadingManagerPlans: boolean;
  userRoleLevel?: string;
}) {
  const p = `st${index}_`;
  const selectedMetric = metrics.find((m) => m.id === subtask.metricDefinitionId);
  const hideValues = selectedMetric?.category === 'MILESTONE' || selectedMetric?.category === 'RATING' || selectedMetric?.category === 'CUSTOM' || !!selectedMetric?.allows_binary_completion;
  const weight = Number(subtask.weight) || 0;
  const krS = Number(kr.start_value ?? 0);
  const krT = Number(kr.target_value ?? 0);
  const previewTarget = krS + ((krT - krS) * weight) / 100;

  // Auto-calculate target from remaining target capacity
  const remainingTarget = selectedAW?.remaining_target_value ?? 0;
  const autoTarget = remainingPct > 0 && remainingTarget > 0 && weight > 0
    ? Number(((remainingTarget * weight) / remainingPct).toFixed(2))
    : previewTarget;

  useEffect(() => {
    if (preselectedMonth && subtask.monthNumber === "") onUpdate({ monthNumber: preselectedMonth });
  }, []);

  useEffect(() => {
    if (!metrics.length || subtask.metricDefinitionId !== "") return;
    const unit = kr.unit ?? "";
    if (!unit) return;
    const match = metrics.find((m) => (m.unit_of_measure ?? m.unit ?? "").toLowerCase() === unit.toLowerCase());
    if (match) onUpdate({ metricDefinitionId: match.id });
  }, [metrics]);


  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">
          Subtask {index + 1}
          {weight > 0 && (
            <span className="ml-2 text-xs font-normal text-primary/70">({weight}% of KR)</span>
          )}
        </span>
        {canRemove && (
          <button onClick={onRemove} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
            <MdDelete size={16} />
          </button>
        )}
      </div>

      <Field label="Month" required error={fieldErrors[`${p}month`]}>
        {(() => {
          const availableMonths = selectedAW?.months || [];
          const monthNumbers = [1, 2, 3].filter(m => availableMonths.some(am => am.month_number === m && (am.plan_id === null || subtask.monthNumber === m)));
          return (
            <select value={subtask.monthNumber}
              onChange={(e) => onUpdate({ monthNumber: e.target.value === "" ? "" : Number(e.target.value) as 1 | 2 | 3 })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">Select a month…</option>
              {monthNumbers.map((m) => <option key={m} value={m}>Month {m}</option>)}
            </select>
          );
        })()}
      </Field>

      <Field label="Title" required error={fieldErrors[`${p}title`]}>
        <input value={subtask.title} maxLength={TITLE_MAX}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="e.g. Discovery sprint for new module"
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        <div className="text-[10px] text-slate-400 mt-0.5 text-right">{subtask.title.length}/{TITLE_MAX}</div>
      </Field>

      <Field label="Align with Manager Plan" error={fieldErrors[`${p}alignment`]}>
        {loadingManagerPlans ? (
          <div className="animate-pulse h-10 bg-slate-100 rounded-xl" />
        ) : managerPlans.length > 0 ? (
          <select value={subtask.alignedManagerPlanId}
            onChange={(e) => onUpdate({ alignedManagerPlanId: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            <option value="">Select manager plan to align…</option>
            {managerPlans.map((mp) => (
              <option key={mp.id} value={mp.id}>
                {mp.title} ({mp.target_value}{mp.metricDefinition?.unit ? ` ${mp.metricDefinition.unit}` : ''})
              </option>
            ))}
          </select>
        ) : (userRoleLevel === "DIRECTOR" || userRoleLevel === "CEO") ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
             <p className="text-[10px] text-slate-500 italic">Alignment is managed at the quarterly objective level for Department Managers.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
            <div className="text-amber-600 mt-0.5">⚠️</div>
            <div>
              <p className="text-xs font-bold text-amber-800">Manager hasn't planned yet</p>
              <p className="text-[10px] text-amber-700">Your manager needs to publish their plan for this month before you can align.</p>
            </div>
          </div>
        )}
      </Field>

      <Field label="Description (optional)">
        <BulletTextarea value={subtask.description} onValueChange={(v) => onUpdate({ description: v })}
          rows={2} placeholder="What success looks like…"
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none" />
      </Field>

      <Field label="Weight (%)" required error={fieldErrors[`${p}weight`]}>
        <input type="number" value={subtask.weight} min={1} max={remainingPct}
          onChange={(e) => onUpdate({ weight: e.target.value })}
          placeholder={`Max: ${remainingPct}%`}
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Metric Definition">
          <select value={subtask.metricDefinitionId}
            onChange={(e) => onUpdate({ metricDefinitionId: e.target.value === "" ? "" : Number(e.target.value) })}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            <option value="">Auto-inherit from KR</option>
            {metrics.map((m) => <option key={m.id} value={m.id}>{m.name}{(m.unit_of_measure || m.unit) ? ` (${m.unit_of_measure || m.unit})` : ""}</option>)}
          </select>
        </Field>
        {!hideValues && (
          <Field label="Start Value" error={fieldErrors[`${p}startValue`]}>
            <input type="number" value={subtask.startValue} onChange={(e) => onUpdate({ startValue: e.target.value })}
              className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ${fieldErrors[`${p}startValue`] ? "border-rose-300 focus:ring-rose-100" : "border-slate-200 focus:border-primary focus:ring-primary/20"}`} />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {!hideValues && (
          <Field label="Target Value" error={fieldErrors[`${p}targetValue`]}>
            <input type="number" value={subtask.targetValue} onChange={(e) => onUpdate({ targetValue: e.target.value })}
              placeholder={autoTarget ? `Auto: ${autoTarget.toFixed(2)}` : "Override…"}
              className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ${fieldErrors[`${p}targetValue`] ? "border-rose-300 focus:ring-rose-100" : "border-slate-200 focus:border-primary focus:ring-primary/20"}`} />
          </Field>
        )}
        <div className={`flex flex-col gap-2 ${hideValues ? "col-span-2 py-2" : "pt-6"}`}>
          {!selectedMetric?.value_based_progress && (
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input type="checkbox" checked={subtask.contributeToScore} onChange={(e) => onUpdate({ contributeToScore: e.target.checked })}
                className="w-4 h-4 rounded text-primary border-slate-300" />
              Contribute to Score
            </label>
          )}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
            <input type="checkbox" checked={subtask.contributeToValue} onChange={(e) => onUpdate({ contributeToValue: e.target.checked })}
              className="w-4 h-4 rounded text-primary border-slate-300" />
            Contribute to Value
          </label>
        </div>
      </div>

      {!hideValues && (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Target: <strong className="tabular-nums">{autoTarget.toFixed(2)}{kr.unit ? ` ${kr.unit}` : ""}</strong>
          {" · "}Remaining after: <strong className="tabular-nums">{Math.max(0, remainingPct - weight)}%</strong>
          {remainingTarget > 0 && (
            <span className="ml-2 text-emerald-600">· <strong className="tabular-nums">{Math.max(0, remainingTarget - autoTarget).toFixed(2)}</strong>{kr.unit ? ` ${kr.unit}` : ""} target remaining</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Full View Layout (2:3 split) ──────────────────────────────────────────

function FullViewLayout({
  krs, loadingKrs, hasLoadFailures, krWeights, selectedKrId, onSelectKr, selectedKr,
  remainingPct, allocatedPct,
  subtasks, onUpdateSubtask, onAddSubtask, onRemoveSubtask, canAddSubtask, totalSubtaskWeight,
  metrics, fieldErrors, error, preselectedMonth, setStep, selectedAW, managerPlans, loadingManagerPlans, userRoleLevel,
}: {
  krs: AddMonthlyKR[]; loadingKrs: boolean; hasLoadFailures: boolean;
  krWeights: Record<string, AvailableWeight | null>; selectedKrId: string | null;
  onSelectKr: (id: string) => void; selectedKr: AddMonthlyKR | null;
  remainingPct: number; allocatedPct: number;
  subtasks: SubtaskForm[]; onUpdateSubtask: (id: string, p: Partial<SubtaskForm>) => void;
  onAddSubtask: () => void; onRemoveSubtask: (id: string) => void; canAddSubtask: boolean;
  totalSubtaskWeight: number; metrics: MetricDefinition[]; fieldErrors: Record<string, string>;
  error: string | null; preselectedMonth?: 1 | 2 | 3; setStep: (s: Step) => void;
  selectedAW: AvailableWeight | null;
  managerPlans: Record<number, MonthlyPlan[]>;
  loadingManagerPlans: boolean;
  userRoleLevel?: string;
}) {
  const step1Done = !!selectedKrId;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
      {/* Left: Select KR (2/5) */}
      <div className={`lg:col-span-2 flex flex-col gap-3 ${step1Done ? "opacity-90" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step1Done ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}>
            {step1Done ? "✓" : "1"}
          </div>
          <h4 className="font-bold text-slate-800 text-sm">Select Key Result</h4>
        </div>
        <div className="flex-1 bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="h-full overflow-y-auto p-3">
            <Step1
              krs={krs} loading={loadingKrs} hasLoadFailures={hasLoadFailures}
              krWeights={krWeights} selectedKrId={selectedKrId} onSelect={(id) => { onSelectKr(id); setStep(2); }} />
          </div>
        </div>
      </div>

      {/* Right: Configure (3/5) */}
      <div className={`lg:col-span-3 flex flex-col gap-3 transition-all duration-300 ${!step1Done ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step1Done ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-400"}`}>
            2
          </div>
          <h4 className="font-bold text-slate-800 text-sm">Configure Plans</h4>
        </div>
        <div className="flex-1 bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="h-full overflow-y-auto p-4">
            {selectedKr ? (
              <ConfigurePanel
                kr={selectedKr} remainingPct={remainingPct}
                allocatedPct={allocatedPct} subtasks={subtasks} onUpdateSubtask={onUpdateSubtask}
                onAddSubtask={onAddSubtask} onRemoveSubtask={onRemoveSubtask}
                canAddSubtask={canAddSubtask} totalSubtaskWeight={totalSubtaskWeight}
                metrics={metrics} fieldErrors={fieldErrors} error={error}
                preselectedMonth={preselectedMonth} selectedAW={selectedAW}
                managerPlans={managerPlans}
                loadingManagerPlans={loadingManagerPlans}
              />
            ) : (
              <div className="text-center py-8 text-sm text-slate-400">
                Select a Key Result first
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold tracking-wide uppercase text-slate-500 mb-1.5 inline-block">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <div className="text-[11px] text-rose-600 mt-1 font-medium">{error}</div>}
    </div>
  );
}
