import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import { useState, useMemo } from "react";
import { MdCheck, MdTrendingUp } from "react-icons/md";
import Button from "../../../../components/Core/ui/Button";
import BulletTextarea from "../../../../components/common/BulletTextarea";
import Toggle from "../../../../components/Core/ui/Toggle";
import type { DailyPlan, DailyStatus } from "../../../../../types/okr.types";

interface DailyPlanProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: DailyPlan & { _weeklyPlanTitle?: string };
  onSave: (data: {
    current_value: number;
    status: DailyStatus;
    notes?: string;
    is_blocked?: boolean;
    blocked_reason?: string;
  }) => Promise<void>;
}

/** Enhanced modal for detailed Daily Plan progress updates with auto-calculated status. */
export default function DailyPlanProgressModal({
  isOpen,
  onClose,
  plan,
  onSave,
}: DailyPlanProgressModalProps) {
  const [currentValue, setCurrentValue] = useState(plan.current_value);
  const [notes, setNotes] = useState(plan.notes ?? "");
  const [isBlocked, setIsBlocked] = useState((plan as any).is_blocked ?? false);
  const [blockedReason, setBlockedReason] = useState(
    (plan as any).blocked_reason ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const isMilestoneMetric =
    plan.metricDefinition?.category === "MILESTONE"

  const sliderMin = Math.min(plan.start_value, plan.target_value);
  const sliderMax = Math.max(plan.start_value, plan.target_value);
  const range = sliderMax - sliderMin;

  const beforePct = useMemo(() => {
    if (range === 0) return plan.current_value >= plan.target_value ? 100 : 0;
    return Math.max(
      0,
      Math.min(100, ((plan.current_value - plan.start_value) / range) * 100),
    );
  }, [plan.current_value, plan.start_value, plan.target_value, range]);

  const afterPct = useMemo(() => {
    if (range === 0) return currentValue >= plan.target_value ? 100 : 0;
    return Math.max(
      0,
      Math.min(100, ((currentValue - sliderMin) / range) * 100),
    );
  }, [currentValue, plan.target_value, range, sliderMin]);

  // Auto-calculate status based on score
  const computedStatus = useMemo((): DailyStatus => {
    if (isBlocked) return "SKIPPED";
    if (afterPct <= 0) return "PENDING";
    if (afterPct >= 100) return "COMPLETED";
    return "IN_PROGRESS";
  }, [afterPct, isBlocked]);

  const handleQuickComplete = () => {
    setCurrentValue(plan.target_value);
    setIsBlocked(false);
  };

  const handleMilestoneToggle = (nextCompleted: boolean) => {
    setIsBlocked(!nextCompleted);
    setCurrentValue(nextCompleted ? plan.target_value : plan.start_value);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = Number(e.target.value);
    setCurrentValue(Number(newVal.toFixed(2)));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave({
        current_value: currentValue,
        status: computedStatus,
        notes: notes.trim() || undefined,
        is_blocked: isBlocked,
        blocked_reason: blockedReason.trim() || undefined,
      });
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    currentValue !== plan.current_value ||
    computedStatus !== plan.status ||
    isBlocked !== ((plan as any).is_blocked ?? false) ||
    (notes.trim() || "") !== (plan.notes ?? "") ||
    (blockedReason.trim() || "") !== ((plan as any).blocked_reason ?? "");

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title="Update Daily Progress"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={MdTrendingUp}
            onClick={handleSubmit}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? "Saving..." : "Save Progress"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Task Context */}
        <div className="p-4 rounded-2xl bg-linear-to-r from-primary/5 to-primary/10 border border-primary/10">
          <h3 className="text-base font-bold text-slate-800 mb-1">
            {plan.title}
          </h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="font-semibold">{plan.completion_day}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>{(plan as any)._weeklyPlanTitle || "Weekly Plan"}</span>
          </div>
        </div>

        {/* Auto-calculated Status Display */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">
            Status
          </span>
          <div className="text-sm font-bold text-slate-700">
            {isBlocked ? (
              <span className="text-amber-600">🚫 Blocked</span>
            ) : afterPct <= 0 ? (
              <span className="text-slate-600">⏸ Pending</span>
            ) : afterPct >= 100 ? (
              <span className="text-green-600">✓ Completed</span>
            ) : (
              <span className="text-blue-600">▶ In Progress</span>
            )}
          </div>
        </div>

        {/* Progress Values */}
        {/* <div>
          <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">
            {isMilestoneMetric ? "Completion" : "Progress Value"}
          </label>
          {isMilestoneMetric ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleMilestoneToggle(true)}
                className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all ${
                  computedStatus === "COMPLETED"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                Achieved
              </button>
              <button
                type="button"
                onClick={() => handleMilestoneToggle(false)}
                className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all ${
                  computedStatus !== "COMPLETED"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                Not Achieved
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Start
                </span>
                <span className="text-sm font-black text-slate-600">
                  {plan.start_value}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-center">
                <span className="block text-[10px] font-bold text-primary/60 uppercase mb-1">
                  Current
                </span>
                <input
                  type="number"
                  value={currentValue === 0 ? "" : currentValue}
                  onChange={(e) =>
                    setCurrentValue(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  placeholder="Enter value"
                  className="w-full text-center text-sm font-black text-primary bg-transparent outline-none"
                  step="any"
                />
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Target
                </span>
                <span className="text-sm font-black text-slate-600">
                  {plan.target_value}
                </span>
              </div>
            </div>
          )}
        </div> */}
        {/* Progress Values */}
        <div>
          <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">
            {isMilestoneMetric ? "Completion Status" : "Progress Value"}
          </label>

          {isMilestoneMetric ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleMilestoneToggle(true)}
                className={`rounded-2xl border-2 px-5 py-4 text-sm font-bold transition-all ${computedStatus === "COMPLETED"
                  ? "border-green-300 bg-green-50 text-green-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
              >
                <div className="text-lg mb-1">✓</div>
                Achieved
              </button>

              <button
                type="button"
                onClick={() => handleMilestoneToggle(false)}
                className={`rounded-2xl border-2 px-5 py-4 text-sm font-bold transition-all ${computedStatus !== "COMPLETED"
                  ? "border-amber-300 bg-amber-50 text-amber-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
              >
                <div className="text-lg mb-1">✕</div>
                Not Achieved
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Start
                </span>
                <span className="text-sm font-black text-slate-600">
                  {plan.start_value}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-center">
                <span className="block text-[10px] font-bold text-primary/60 uppercase mb-1">
                  Current
                </span>
                <input
                  type="number"
                  value={currentValue === 0 ? "" : currentValue}
                  onChange={(e) =>
                    setCurrentValue(
                      e.target.value === "" ? 0 : Number(e.target.value)
                    )
                  }
                  placeholder="Enter value"
                  className="w-full text-center text-sm font-black text-primary bg-transparent outline-none"
                  step="any"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Target
                </span>
                <span className="text-sm font-black text-slate-600">
                  {plan.target_value}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Slider */}
        {!isMilestoneMetric && range > 0 && (
          <div className="space-y-2">
            <style>{`
              .range-slider {
                -webkit-appearance: none;
                width: 100%;
                height: 8px;
                border-radius: 9999px;
                background: rgb(226, 232, 240);
                outline: none;
                padding: 0;
                margin: 0;
              }
              .range-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: #3b82f6;
                cursor: grab;
                border: 3px solid white;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
              }
              .range-slider::-webkit-slider-thumb:hover {
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.6);
              }
              .range-slider::-webkit-slider-thumb:active {
                cursor: grabbing;
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.7);
              }
              .range-slider::-moz-range-track {
                background: transparent;
                border: none;
              }
              .range-slider::-moz-range-thumb {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: #3b82f6;
                cursor: grab;
                border: 3px solid white;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
              }
              .range-slider::-moz-range-thumb:hover {
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.6);
              }
              .range-slider::-moz-range-thumb:active {
                cursor: grabbing;
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.7);
              }
            `}</style>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={1}
              value={currentValue}
              onChange={handleSliderChange}
              className="range-slider"
              title="Drag to adjust progress"
            />
          </div>
        )}

        {/* Before → After Comparison */}
        {!isMilestoneMetric && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Progress Preview
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Before */}
              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">
                  Before
                </span>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-slate-300 rounded-full transition-all"
                    style={{ width: `${beforePct}%` }}
                  />
                </div>
                <span className="text-xs font-black text-slate-500">
                  {Math.round(beforePct)}%
                </span>
              </div>
              {/* After */}
              <div className="p-3 rounded-xl border border-primary/15 bg-primary/5">
                <span className="text-[10px] font-bold text-primary/60 uppercase block mb-2">
                  After
                </span>
                <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full transition-all ${afterPct >= 100 ? "bg-green-500" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, afterPct)}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-black ${afterPct >= 100 ? "text-green-600" : "text-primary"}`}
                >
                  {Math.round(afterPct)}%
                </span>
              </div>
            </div>
          </div>)}

        {/* Blocked Status */}
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
          <Toggle
            label="Mark as Blocked"
            description="Task cannot be completed due to blockers"
            checked={isBlocked}
            onChange={setIsBlocked}
          />
          {isBlocked && (
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-bold text-amber-600 uppercase tracking-wider">
                Blocker Description
              </label>
              <textarea
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                placeholder="What is blocking this task?..."
                className="w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50"
                rows={2}
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Notes{" "}
            <span className="text-slate-300 font-normal normal-case">
              (optional)
            </span>
          </label>
          <BulletTextarea
            value={notes}
            onValueChange={(val) => setNotes(val)}
            className="min-h-20 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="What was accomplished today..."
          />
        </div>

        {/* Quick Complete Button */}
        {!isMilestoneMetric &&
          computedStatus !== "COMPLETED" &&
          currentValue < plan.target_value &&
          !isBlocked && (
            <button
              type="button"
              onClick={handleQuickComplete}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-green-200 text-green-600 text-sm font-bold hover:bg-green-50 hover:border-green-300 transition-all"
            >
              <MdCheck className="text-lg" />
              Quick Complete (set to target)
            </button>
          )}
      </div>
    </ModalLayout>
  );
}
