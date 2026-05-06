import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";
import BulletTextarea from "../../../../components/common/BulletTextarea";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  metricCategory: string; // BINARY, NUMERIC, PERCENTAGE, etc.
  currentValue: number;
  onChangeCurrentValue: (n: number) => void;
  targetValue: number;
  onChangeTargetValue?: (n: number) => void;
  isCompleted: boolean;
  onChangeIsCompleted: (v: boolean) => void;
  note: string;
  onChangeNote: (v: string) => void;
  monthNumber: number;
  weekNumber: number;
  onChangeMonthNumber: (n: number) => void;
  onChangeWeekNumber: (n: number) => void;
  onSubmit: () => void;
  monthOptions?: Array<{ label: string; value: number }>;
  weekOptions?: Array<{ label: string; value: number }>;
};

/** M11 — Progress update (now using raw current_value / is_completed logic). */
export default function ProgressUpdateModal({
  isOpen,
  onClose,
  metricCategory,
  currentValue,
  onChangeCurrentValue,
  targetValue,
  onChangeTargetValue,
  isCompleted,
  onChangeIsCompleted,
  note,
  onChangeNote,
  monthNumber,
  weekNumber,
  onChangeMonthNumber,
  onChangeWeekNumber,
  onSubmit,
  monthOptions,
  weekOptions,
}: Props) {
  console.log("[DEBUG] ProgressUpdateModal (Weekly/KR) Render Props:", {
    currentValue,
    targetValue,
  });
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
      title="Submit Progress Update"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Month #
            </label>
            {monthOptions && monthOptions.length > 0 ? (
              <select
                value={monthNumber}
                onChange={(e) => onChangeMonthNumber(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min={1}
                max={12}
                value={monthNumber}
                onChange={(e) =>
                  onChangeMonthNumber(
                    Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Week #
            </label>
            {weekOptions && weekOptions.length > 0 ? (
              <select
                value={weekNumber}
                onChange={(e) => onChangeWeekNumber(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
              >
                {weekOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min={1}
                max={53}
                value={weekNumber}
                onChange={(e) =>
                  onChangeWeekNumber(
                    Math.min(53, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            )}
          </div>
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
                Binary Key Result completion status
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
          <BulletTextarea
            value={note}
            onValueChange={(val) => onChangeNote(val)}
            className="min-h-[88px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="What moved, results, dependencies..."
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
