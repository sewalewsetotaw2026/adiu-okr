import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import { useState, useMemo } from "react";
import {
  MdTrendingUp,
} from "react-icons/md";
import Button from "../../../../components/Core/ui/Button";
import BulletTextarea from "../../../../components/common/BulletTextarea";
import type { WeeklyPlan } from "../../../../../types/okr.types";

interface WeeklyPlanProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: WeeklyPlan;
  onSave: (data: {
    current_value: number;
    notes?: string;
  }) => Promise<void>;
}

export default function WeeklyPlanProgressModal({
  isOpen,
  onClose,
  plan,
  onSave,
}: WeeklyPlanProgressModalProps) {
  const [currentValue, setCurrentValue] = useState(plan.current_value);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isMilestoneMetric =
    plan.metricDefinition?.category === "MILESTONE";

  const range = plan.target_value - plan.start_value;

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
      Math.min(100, ((currentValue - plan.start_value) / range) * 100),
    );
  }, [currentValue, plan.start_value, plan.target_value, range]);

  const handleMilestoneToggle = (nextCompleted: boolean) => {
    setCurrentValue(nextCompleted ? plan.target_value : plan.start_value);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value);
    const newVal = plan.start_value + (range * pct) / 100;
    setCurrentValue(Number(newVal.toFixed(2)));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave({
        current_value: currentValue,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = currentValue !== plan.current_value || (notes.trim() || "") !== "";

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title="Update Weekly Progress"
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
            <span className="font-semibold">Week {plan.week_number}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>{plan.parent_monthly_plan?.parent_kr_title || "—"}</span>
          </div>
        </div>

        {/* Progress Values */}
        <div>
          <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">
            {isMilestoneMetric ? "Completion" : "Progress Value"}
          </label>
          {isMilestoneMetric ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleMilestoneToggle(true)}
                className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all ${
                  currentValue >= plan.target_value
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
                  currentValue < plan.target_value
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
                  value={currentValue}
                  onChange={(e) => setCurrentValue(Number(e.target.value))}
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
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(afterPct)}
              onChange={handleSliderChange}
              className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-primary"
            />
          </div>
        )}

        {/* Before → After Comparison */}
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
            placeholder="What was accomplished..."
          />
        </div>
      </div>
    </ModalLayout>
  );
}
