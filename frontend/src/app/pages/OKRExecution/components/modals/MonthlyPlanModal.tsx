import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";

type MonthlyPlanItem = {
  id: string;
  krId: number | "";
  title: string;
  target: number | "";
  initial: number | "";
  metricId: number | "";
  managerMonthPlanItemId: number | "";
  isDirect: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  krOptions: Array<{ id: number; title: string; targetValue: number }>;

  monthNumber: number;
  description: string;
  onChangeMonthNumber: (n: number) => void;
  onChangeDescription: (v: string) => void;

  items: MonthlyPlanItem[];
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onChangeItem: (id: string, field: keyof MonthlyPlanItem, val: any) => void;

  alignmentOptions?: Array<{
    id: number;
    title: string;
    targetValue: number;
    krTitle?: string;
  }>;
  requireAlignment?: boolean;
  metrics: Array<{ id: number; name: string; unit_of_measure?: string }>;
  onSubmit: () => void;
  isEdit: boolean;
  submitting?: boolean;
};

/** M09 — Create / edit monthly plan. */
export default function MonthlyPlanModal({
  isOpen,
  onClose,
  krOptions,
  monthNumber,
  description,
  onChangeMonthNumber,
  onChangeDescription,
  items,
  onAddItem,
  onRemoveItem,
  onChangeItem,
  alignmentOptions = [],
  requireAlignment = false,
  metrics,
  onSubmit,
  isEdit,
  submitting,
}: Props) {
  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Monthly Plan" : "New Monthly Plan"}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-4">
        <div className="flex justify-between items-end gap-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Month #
            </label>
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
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Monthly Plan
          </label>
          <textarea
            value={description}
            onChange={(e) => onChangeDescription(e.target.value)}
            className="min-h-[80px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Focus for this month..."
          />
        </div>{" "}
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <label className="block text-xs font-semibold text-k-medium-grey tracking-wide">
            Plan Items
          </label>
          {items.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              No plan items added yet. Click "Add Plan Item" to start.
            </p>
          ) : (
            <div className="space-y-6">
              {items.map((item) => {
                const kr = krOptions.find((o) => o.id === item.krId);
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-gray-100 bg-gray-50/30 relative group"
                  >
                    {!isEdit && (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 shadow-sm flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-gray-400 tracking-wider">
                          Target Key Result
                        </label>
                        <select
                          value={item.krId === "" ? "" : String(item.krId)}
                          onChange={(e) =>
                            onChangeItem(
                              item.id,
                              "krId",
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                            )
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/10"
                        >
                          <option value="">Select KR…</option>
                          {krOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.title}
                            </option>
                          ))}
                        </select>
                        {kr && (
                          <span className="mt-1 block text-[10px] text-gray-400 italic">
                            Total KR Target:{" "}
                            <span className="font-semibold text-primary">
                              {kr.targetValue}
                            </span>
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-gray-400 tracking-wider">
                          Item Title / Description
                        </label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) =>
                            onChangeItem(item.id, "title", e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                          placeholder="What specific outcome are you planning for?"
                        />
                      </div>

                      {(requireAlignment || alignmentOptions.length > 0) && (
                        <div>
                          <label className="mb-1 flex items-center text-[10px] font-bold text-gray-400 tracking-wider">
                            Align To Manager Plan Item{" "}
                            {requireAlignment && (
                              <span className="ml-1 text-red-500">*</span>
                            )}
                          </label>
                          <select
                            value={
                              item.managerMonthPlanItemId === ""
                                ? ""
                                : String(item.managerMonthPlanItemId)
                            }
                            onChange={(e) =>
                              onChangeItem(
                                item.id,
                                "managerMonthPlanItemId",
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/10"
                          >
                            <option value="">Select manager plan item…</option>
                            {alignmentOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.title} (Target: {opt.targetValue}){" "}
                                {opt.krTitle ? `- ${opt.krTitle}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100/50 mt-1">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold text-gray-400 tracking-wider">
                            Metric
                          </label>
                          <select
                            value={
                              item.metricId === "" ? "" : String(item.metricId)
                            }
                            onChange={(e) =>
                              onChangeItem(
                                item.id,
                                "metricId",
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/10"
                          >
                            <option value="">Metric…</option>
                            {metrics.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                                {m.unit_of_measure
                                  ? ` (${m.unit_of_measure})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="mb-1 block text-[10px] font-bold text-gray-400 tracking-wider">
                              Target
                            </label>
                            <input
                              type="number"
                              value={item.target}
                              onChange={(e) =>
                                onChangeItem(
                                  item.id,
                                  "target",
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                                )
                              }
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                              placeholder="0"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="mb-1 block text-[10px] font-bold text-gray-400 tracking-wider">
                              Initial
                            </label>
                            <input
                              type="number"
                              value={item.initial}
                              onChange={(e) =>
                                onChangeItem(
                                  item.id,
                                  "initial",
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                                )
                              }
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            id={`is_direct_${item.id}`}
                            checked={item.isDirect !== false}
                            onChange={(e) =>
                              onChangeItem(item.id, "isDirect", e.target.checked)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <label
                            htmlFor={`is_direct_${item.id}`}
                            className="text-[11px] font-semibold text-k-medium-grey"
                          >
                            Directly contribute to parent KR
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onAddItem}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/20 py-4 text-sm font-bold text-primary transition-all hover:bg-primary/5 hover:border-primary/40"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Another Plan Item
          </button>
        </div>
      </div>
      <ApprovalFooter
        onCancel={onClose}
        onConfirm={onSubmit}
        confirmText={isEdit ? "Save Changes" : "Create Plan"}
        confirmLoading={submitting}
        confirmDisabled={submitting}
      />
    </ModalLayout>
  );
}
