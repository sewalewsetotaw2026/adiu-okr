import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import { useState, useMemo } from "react";
import { MdCheck, MdTrendingUp, MdSkipNext, MdPlayArrow, MdPause } from "react-icons/md";
import Button from "../../../../components/Core/ui/Button";
import BulletTextarea from "../../../../components/common/BulletTextarea";
import type { DailyPlan, DailyStatus } from "../../../../../types/okr.types";

interface DailyPlanProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: DailyPlan & { _weeklyPlanTitle?: string };
  onSave: (data: {
    current_value: number;
    status: DailyStatus;
    notes?: string;
  }) => Promise<void>;
}

const STATUS_OPTIONS: { value: DailyStatus; label: string; icon: typeof MdCheck; color: string; bg: string }[] = [
  { value: "PENDING", label: "Pending", icon: MdPause, color: "text-slate-600", bg: "bg-slate-100 border-slate-200 hover:border-slate-300" },
  { value: "IN_PROGRESS", label: "In Progress", icon: MdPlayArrow, color: "text-blue-600", bg: "bg-blue-50 border-blue-200 hover:border-blue-300" },
  { value: "COMPLETED", label: "Completed", icon: MdCheck, color: "text-green-600", bg: "bg-green-50 border-green-200 hover:border-green-300" },
  { value: "SKIPPED", label: "Skipped", icon: MdSkipNext, color: "text-amber-600", bg: "bg-amber-50 border-amber-200 hover:border-amber-300" },
];

/** Enhanced modal for detailed Daily Plan progress updates. */
export default function DailyPlanProgressModal({
  isOpen,
  onClose,
  plan,
  onSave,
}: DailyPlanProgressModalProps) {
  const [currentValue, setCurrentValue] = useState(plan.current_value);
  const [status, setStatus] = useState<DailyStatus>(plan.status);
  const [notes, setNotes] = useState(plan.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const range = plan.target_value - plan.start_value;

  const beforePct = useMemo(() => {
    if (range === 0) return plan.current_value >= plan.target_value ? 100 : 0;
    return Math.max(0, Math.min(100, ((plan.current_value - plan.start_value) / range) * 100));
  }, [plan.current_value, plan.start_value, plan.target_value, range]);

  const afterPct = useMemo(() => {
    if (range === 0) return currentValue >= plan.target_value ? 100 : 0;
    return Math.max(0, Math.min(100, ((currentValue - plan.start_value) / range) * 100));
  }, [currentValue, plan.start_value, plan.target_value, range]);

  const handleQuickComplete = () => {
    setCurrentValue(plan.target_value);
    setStatus("COMPLETED");
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value);
    const newVal = plan.start_value + (range * pct) / 100;
    setCurrentValue(Number(newVal.toFixed(2)));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave({ current_value: currentValue, status, notes: notes.trim() || undefined });
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    currentValue !== plan.current_value ||
    status !== plan.status ||
    (notes.trim() || "") !== (plan.notes ?? "");

  return (
    <ModalLayout isOpen={isOpen} onClose={onClose} title="Update Daily Progress">
      <div className="space-y-5">
        {/* Task Context */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10">
          <h3 className="text-base font-bold text-slate-800 mb-1">{plan.title}</h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="font-semibold">{plan.completion_day}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>{(plan as any)._weeklyPlanTitle || "Weekly Plan"}</span>
          </div>
        </div>

        {/* Status Selector */}
        <div>
          <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Status
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 transition-all text-sm font-semibold ${
                    isSelected
                      ? `${opt.bg} ${opt.color} ring-2 ring-offset-1 ring-current/20 border-current/30`
                      : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                  }`}
                >
                  <Icon className="text-base" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress Values */}
        <div>
          <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Progress Value
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start</span>
              <span className="text-sm font-black text-slate-600">{plan.start_value}</span>
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-center">
              <span className="block text-[10px] font-bold text-primary/60 uppercase mb-1">Current</span>
              <input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(Number(e.target.value))}
                className="w-full text-center text-sm font-black text-primary bg-transparent outline-none"
                step="any"
              />
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target</span>
              <span className="text-sm font-black text-slate-600">{plan.target_value}</span>
            </div>
          </div>
        </div>

        {/* Slider */}
        {range > 0 && (
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
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Before</span>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-1">
                <div
                  className="h-full bg-slate-300 rounded-full transition-all"
                  style={{ width: `${beforePct}%` }}
                />
              </div>
              <span className="text-xs font-black text-slate-500">{Math.round(beforePct)}%</span>
            </div>
            {/* After */}
            <div className="p-3 rounded-xl border border-primary/15 bg-primary/5">
              <span className="text-[10px] font-bold text-primary/60 uppercase block mb-2">After</span>
              <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all ${afterPct >= 100 ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, afterPct)}%` }}
                />
              </div>
              <span className={`text-xs font-black ${afterPct >= 100 ? "text-green-600" : "text-primary"}`}>
                {Math.round(afterPct)}%
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Notes <span className="text-slate-300 font-normal normal-case">(optional)</span>
          </label>
          <BulletTextarea
            value={notes}
            onValueChange={(val) => setNotes(val)}
            className="min-h-[80px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="What was accomplished today..."
          />
        </div>

        {/* Quick Complete Button */}
        {status !== "COMPLETED" && currentValue < plan.target_value && (
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

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-5 mt-5 border-t border-slate-100">
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
    </ModalLayout>
  );
}
