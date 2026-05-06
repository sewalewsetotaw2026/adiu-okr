import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { MdCheck } from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import { updateWeeklyPlan, fetchMetricDefinitions } from "../../../services/okr-execution.api";
import type { WeeklyPlan, MetricDefinition } from "../../../../types/okr.types";

const TITLE_MAX = 150;

export interface EditWeeklyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: WeeklyPlan | null;
  onSaved: (plan: WeeklyPlan) => void;
}

export default function EditWeeklyPlanModal({
  isOpen,
  onClose,
  plan,
  onSaved,
}: EditWeeklyPlanModalProps) {
  const [title, setTitle] = useState("");
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [metricDefinitionId, setMetricDefinitionId] = useState<number | "">("");
  const [startValue, setStartValue] = useState<string>("0");
  const [targetValue, setTargetValue] = useState<string>("");
  const [contributeToScore, setContributeToScore] = useState(true);
  const [contributeToValue, setContributeToValue] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !plan) return;
    setTitle(plan.title || "");
    setMetricDefinitionId(plan.metric_definition_id || "");
    setStartValue(String(plan.start_value ?? 0));
    setTargetValue(String(plan.target_value ?? ""));
    setContributeToScore(plan.contribute_to_score ?? true);
    setContributeToValue(plan.contribute_to_value ?? true);
    setError(null);
    setFieldErrors({});
    setSubmitting(false);
  }, [isOpen, plan]);

  useEffect(() => {
    if (isOpen) {
      fetchMetricDefinitions().then(setMetrics).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen || !plan) return null;

  const parentMonthlyTarget = Number(plan.parent_monthly_plan?.target_value ?? Infinity);

  const onSave = async () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required.";
    if (title.length > TITLE_MAX) errs.title = `Max ${TITLE_MAX} characters.`;
    if (targetValue !== "") {
      const tv = Number(targetValue);
      if (tv > parentMonthlyTarget) {
        errs.targetValue = `Target (${tv}) exceeds parent monthly plan target (${parentMonthlyTarget}). Reduce the value.`;
      }
      if (startValue !== "" && Number(startValue) > tv) {
        errs.startValue = "Start value cannot exceed target value.";
      }
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateWeeklyPlan(plan.id, {
        title: title.trim(),
        metric_definition_id: metricDefinitionId ? Number(metricDefinitionId) : undefined,
        start_value: startValue !== "" ? Number(startValue) : undefined,
        target_value: targetValue !== "" ? Number(targetValue) : undefined,
        contribute_to_score: contributeToScore,
        contribute_to_value: contributeToValue,
      });
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(
        err?.data?.message ||
          err?.message ||
          "Could not save changes. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Edit Weekly Plan</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-slate-50 ring-1 ring-inset ring-slate-100 px-3 py-2 text-xs text-slate-600 space-y-0.5">
            <div>
              <span className="font-black tracking-widest uppercase text-[10px] text-slate-400 mr-1.5">
                Parent monthly plan:
              </span>
              <span className="font-semibold">
                {plan.parent_monthly_plan?.title ?? "—"}
                {plan.parent_monthly_plan?.month_number != null
                  ? ` · M${plan.parent_monthly_plan.month_number}`
                  : ""}
              </span>
            </div>
            <div>
              <span className="font-black tracking-widest uppercase text-[10px] text-slate-400 mr-1.5">
                Weight:
              </span>
              <span className="font-semibold tabular-nums">
                {plan.weight_pct}%
              </span>
            </div>
            <div className="text-[11px] text-slate-500 italic mt-1">
              Weight cannot be changed. Delete and recreate to adjust.
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold tracking-wide uppercase text-slate-500 mb-1.5 inline-block">
              Title<span className="text-rose-500 ml-0.5">*</span>
            </label>
            <input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="text-[10px] text-slate-400 mt-1 text-right tabular-nums">
              {title.length}/{TITLE_MAX}
            </div>
          </div>

          {(() => {
            const selectedMetric = metrics.find((m) => m.id === metricDefinitionId);
            const hideValues = selectedMetric?.category === 'MILESTONE' || selectedMetric?.category === 'RATING' || selectedMetric?.category === 'CUSTOM' || !!selectedMetric?.allows_binary_completion;
            return (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold tracking-wide uppercase text-slate-500 mb-1.5 inline-block">
                      Metric Definition
                    </label>
                    <select
                      value={metricDefinitionId}
                      onChange={(e) =>
                        setMetricDefinitionId(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Auto-inherit from Monthly Plan</option>
                      {metrics.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}{(m.unit_of_measure || m.unit) ? ` (${m.unit_of_measure || m.unit})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!hideValues && (
                    <div>
                      <label className="text-[11px] font-bold tracking-wide uppercase text-slate-500 mb-1.5 inline-block">
                        Start Value
                      </label>
                      <input
                        type="number"
                        value={startValue}
                        onChange={(e) => setStartValue(e.target.value)}
                        className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ${
                          fieldErrors.startValue
                            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                            : "border-slate-200 focus:border-primary focus:ring-primary/20"
                        }`}
                      />
                      {fieldErrors.startValue && (
                        <div className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.startValue}</div>
                      )}
                    </div>
                  )}
                </div>

                {!hideValues && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold tracking-wide uppercase text-slate-500 mb-1.5 inline-block">
                        Target Value
                      </label>
                      <input
                        type="number"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        placeholder="Override target…"
                        className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ${
                          fieldErrors.targetValue
                            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                            : targetValue !== "" && Number(targetValue) > parentMonthlyTarget
                              ? "border-amber-300 focus:border-amber-400 focus:ring-amber-100"
                              : "border-slate-200 focus:border-primary focus:ring-primary/20"
                        }`}
                      />
                      {fieldErrors.targetValue ? (
                        <div className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.targetValue}</div>
                      ) : targetValue !== "" && Number(targetValue) > parentMonthlyTarget ? (
                        <div className="text-[11px] text-amber-600 mt-1 font-medium flex items-center gap-1">
                          <span>⚠</span>
                          <span>Exceeds monthly plan target ({parentMonthlyTarget}). Will be blocked on save.</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-3 pt-6">
                      {!selectedMetric?.value_based_progress && (
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={contributeToScore}
                            onChange={(e) => setContributeToScore(e.target.checked)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                          />
                          <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">
                            Contribute to Score
                          </span>
                        </label>
                      )}
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={contributeToValue}
                          onChange={(e) => setContributeToValue(e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                        />
                        <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">
                          Contribute to Value
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {hideValues && (
                  <div className="flex flex-col gap-3 py-2">
                    {!selectedMetric?.value_based_progress && (
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={contributeToScore}
                          onChange={(e) => setContributeToScore(e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                        />
                        <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">
                          Contribute to Score
                        </span>
                      </label>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={contributeToValue}
                        onChange={(e) => setContributeToValue(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                      />
                      <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">
                        Contribute to Value
                      </span>
                    </label>
                  </div>
                )}
              </>
            );
          })()}

          {error && (
            <div className="rounded-xl bg-rose-50 ring-1 ring-inset ring-rose-100 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={MdCheck}
            onClick={() => void onSave()}
            loading={submitting}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
