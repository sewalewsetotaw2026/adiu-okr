import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";
import Button from "../../../../components/Core/ui/Button";
import { MdAdd, MdClose } from "react-icons/md";
import Toggle from "../../../../components/Core/ui/Toggle";
import BulletTextarea from "../../../../components/common/BulletTextarea";

type MonthlyPlanItem = {
  id: string;
  krId: number | "";
  title: string;
  target: number | "";
  initial: number | "";
  metricId: number | "";
  managerMonthPlanItemId: number | "";
  contributesToScore?: boolean;
  contributesToValue?: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  krOptions: Array<{ id: number; title: string; targetValue: number }>;

  monthNumber: number;
  title: string;
  description: string;
  onChangeMonthNumber: (n: number) => void;
  onChangeTitle: (v: string) => void;
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
  metrics: Array<{
    id: number;
    name: string;
    unit?: string;
    unit_of_measure?: string;
    allows_binary_completion?: boolean;
    value_based_progress?: boolean;
    is_financial?: boolean;
  }>;
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
  title,
  description,
  onChangeMonthNumber,
  onChangeTitle,
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
      footer={
        <ApprovalFooter
          onCancel={onClose}
          onConfirm={onSubmit}
          confirmText={isEdit ? "Save Changes" : "Create Plan"}
          confirmLoading={submitting}
          confirmDisabled={submitting}
        />
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4 items-end">
          <div className="col-span-1">
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
          <div className="col-span-3">
            <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Plan Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="E.g., May Sales Push..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Monthly Plan / Description
          </label>
          <BulletTextarea
            value={description}
            onValueChange={(val) => onChangeDescription(val)}
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
                      <Button
                        variant="white"
                        size="sm"
                        onClick={() => onRemoveItem(item.id)}
                        className="absolute -top-2 -right-2 h-7 w-7 !p-0 rounded-full border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 shadow-sm flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                        icon={MdClose}
                      />
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
                          <option value="">Select Key Result…</option>
                          {krOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.title}
                            </option>
                          ))}
                        </select>
                        {kr && (
                          <span className="mt-1 block text-[10px] text-gray-400 italic">
                            Total Key Result Target:{" "}
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
                                {m.unit_of_measure || m.unit
                                  ? ` (${m.unit_of_measure || m.unit})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        {!metrics.find((m) => m.id === item.metricId)
                          ?.allows_binary_completion && (
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
                        )}
                      </div>

                      <div className="flex flex-col gap-3 mt-4 pt-3 border-t border-gray-50">
                        {(() => {
                          const selectedMetric = metrics.find(
                            (m) => m.id === Number(item.metricId),
                          );
                          return (
                            <>
                              {!selectedMetric?.value_based_progress && (
                                <Toggle
                                  label="Contribute to Score"
                                  description="Plan item completion affects overall score"
                                  checked={item.contributesToScore ?? true}
                                  onChange={(val: boolean) =>
                                    onChangeItem(item.id, "contributesToScore", val)
                                  }
                                />
                              )}

                              {!selectedMetric?.is_financial && (
                                <Toggle
                                  label="Contribute to Value"
                                  description="Update progress affects the KR current value"
                                  checked={item.contributesToValue ?? true}
                                  onChange={(val: boolean) =>
                                    onChangeItem(item.id, "contributesToValue", val)
                                  }
                                />
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Button
            variant="ghost"
            onClick={onAddItem}
            className="w-full py-6 h-auto border-2 border-dashed border-primary/20 text-sm font-bold text-primary transition-all hover:bg-primary/5 hover:border-primary/40"
            icon={MdAdd}
          >
            Add Another Plan Item
          </Button>
        </div>
      </div>
    </ModalLayout>
  );
}
