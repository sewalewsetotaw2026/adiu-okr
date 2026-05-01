import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";
import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  metricCategory: string; // BINARY, NUMERIC, PERCENTAGE, etc.
  currentValue: number;
  onChangeCurrentValue: (n: number) => void;
  targetValue: number;
  isCompleted: boolean;
  onChangeIsCompleted: (v: boolean) => void;
  note: string;
  onChangeNote: (v: string) => void;
  onSubmit: () => void;
  taskTitle: string;
  dailyPlanTitle: string;
  completionDay: string;
};

/** Specialized modal for Daily Plan progress updates. */
export default function DailyPlanProgressModal({
  isOpen,
  onClose,
  metricCategory,
  currentValue,
  onChangeCurrentValue,
  targetValue,
  isCompleted,
  onChangeIsCompleted,
  note,
  onChangeNote,
  onSubmit,
  taskTitle,
  dailyPlanTitle,
  completionDay,
}: Props) {
  const isBinary = metricCategory === "BINARY";

  // Calculate progress percentage for the bar
  const progressPercent =
    targetValue > 0
      ? Number(((currentValue / targetValue) * 100).toFixed(2))
      : isCompleted
        ? 100
        : 0;

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Progress Update"
    >
      <div className="space-y-5">
        {/* Context Header */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
            <label className="mb-1 block text-[10px] font-bold text-k-medium-grey tracking-wider">
              Parent Task
            </label>
            <p className="text-sm font-semibold text-k-dark-grey truncate">
              {taskTitle || "N/A"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
            <label className="mb-1 block text-[10px] font-bold text-k-medium-grey tracking-wider">
              Scheduled Day
            </label>
            <p className="text-sm font-semibold text-primary">
              {completionDay}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
          <label className="mb-1 block text-[10px] font-bold text-primary/70 tracking-wider">
            Daily Plan
          </label>
          <p className="text-base font-bold text-k-dark-grey">
            {dailyPlanTitle}
          </p>
        </div>

        {isBinary ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-k-light-grey/40 px-4 py-3 transition-colors hover:bg-k-light-grey/60">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={(e) => onChangeIsCompleted(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
            />
            <div>
              <p className="text-sm font-semibold text-k-dark-grey">
                Mark as Completed
              </p>
              <p className="text-xs text-k-medium-grey">
                Binary status for this day's task
              </p>
            </div>
          </label>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
                  Current Value
                </label>
                <input
                  type="number"
                  value={currentValue}
                  onChange={(e) => onChangeCurrentValue(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
                  Target Value
                </label>
                <input
                  type="number"
                  value={targetValue}
                  readOnly
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-k-medium-grey">
                <span>Calculated Progress</span>
                <span className="text-k-dark-grey font-semibold tabular-nums">
                  {progressPercent}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Comments
          </label>
          <textarea
            value={note}
            onChange={(e) => onChangeNote(e.target.value)}
            className="min-h-[88px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="What was done today..."
          />
        </div>

      </div>
      <ApprovalFooter
        onCancel={onClose}
        onConfirm={onSubmit}
        confirmText="Submit Update"
      />
    </ModalLayout>
  );
}
