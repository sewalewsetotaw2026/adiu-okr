import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";
import BulletTextarea from "../../../../components/common/BulletTextarea";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  // NEW: KR selection options (filtered by weekly plan group)
  krOptions: Array<{ id: number; title: string; targetValue: number; metricId?: number }>;
  krTargets: Record<number, { target: number | ""; initial: number | ""; metricId: number | ""; isDirect: boolean }>;
  onChangeKrValue: (id: number, field: "target" | "initial" | "metricId" | "isDirect", val: string | number | boolean | "") => void;

  title: string;
  onChangeTitle: (v: string) => void;
  description: string;
  onChangeDescription: (v: string) => void;
  completionDay: string;
  onChangeCompletionDay: (v: string) => void;

  metrics: Array<{ id: number; name: string; unit_of_measure?: string }>;
  onSubmit: () => void;
  isEdit?: boolean;
  submitting?: boolean;
  weeklyPlanOptions?: Array<{ id: number; title: string; tasks: Array<{ id: number; title: string; targetValue: number }> }>;
  selectedWeeklyPlanId?: number | "";
  onChangeWeeklyPlanId?: (id: number) => void;
  selectedTaskIds?: number[];
  onChangeTaskIds?: (ids: number[]) => void;
  existingDays?: string[];
};

/** Create / edit daily plan with multi-KR support. */
export default function DailyPlanModal({
  isOpen,
  onClose,
  krOptions,
  krTargets,
  onChangeKrValue,
  title,
  onChangeTitle,
  description,
  onChangeDescription,
  completionDay,
  onChangeCompletionDay,
  metrics,
  onSubmit,
  isEdit = false,
  submitting,
  weeklyPlanOptions,
  selectedWeeklyPlanId,
  onChangeWeeklyPlanId,
  selectedTaskIds,
  onChangeTaskIds,
  existingDays = [],
}: Props) {
  const days = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ];

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Daily Plan" : "New Daily Plan"}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Plan Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="E.g., Today's Focus..."
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-3">
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Select Tasks For Today
          </label>
          <div className="max-h-[300px] overflow-y-auto space-y-4 rounded-xl border border-gray-100 p-3 bg-gray-50/30">
            {weeklyPlanOptions?.map((w) => (
              <div key={w.id} className="space-y-2 border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {(w.title || "Untitled").split(":")[0]} {/* "Week X" */}
                  </span>
                  <span className="text-[11px] font-bold text-gray-400 tracking-tighter truncate">
                    {(w.title || "Untitled").split(":")[1] || (w.title || "Untitled")}
                  </span>
                </div>
                
                <div className="pl-2 space-y-2">
                  {w.tasks.map((t) => {
                    const isSelected = selectedTaskIds?.includes(t.id);
                    const values = krTargets[t.id] || { target: "", initial: "", metricId: "", isDirect: true };
                    
                    return (
                      <div key={t.id} className={`p-2 rounded-lg border transition-all ${isSelected ? "bg-white border-primary/20 shadow-sm" : "border-transparent hover:bg-white/50"}`}>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const ids = selectedTaskIds || [];
                              if (e.target.checked) {
                                onChangeTaskIds && onChangeTaskIds([...ids, t.id]);
                              } else {
                                onChangeTaskIds && onChangeTaskIds(ids.filter(id => id !== t.id));
                              }
                            }}
                            disabled={isEdit}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
                          />
                          <div className="flex flex-col gap-0.5 flex-1">
                            <span className="text-sm font-semibold text-k-dark-grey group-hover:text-primary transition-colors">{t.title}</span>
                            <span className="text-[10px] text-gray-400">Weekly Target: <span className="font-bold text-gray-600">{t.targetValue}</span></span>
                          </div>
                        </label>

                        {isSelected && (
                          <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t border-gray-50">
                            <div>
                              <label className="mb-1 block text-[10px] font-bold text-gray-400 tracking-wider">Metric</label>
                              <select
                                value={values.metricId}
                                onChange={(e) => onChangeKrValue(t.id, "metricId", e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-primary"
                              >
                                <option value="">Metric...</option>
                                {metrics.map((m) => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-bold text-gray-400 tracking-wider">Daily Target</label>
                              <input
                                type="number"
                                value={values.target}
                                onChange={(e) => onChangeKrValue(t.id, "target", e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary"
                                placeholder="Goal"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-bold text-gray-400 tracking-wider">Initial</label>
                              <input
                                type="number"
                                value={values.initial}
                                onChange={(e) => onChangeKrValue(t.id, "initial", e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary"
                                placeholder="Start"
                              />
                            </div>
                            <div className="col-span-3 mt-1 flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`is_direct_daily_${t.id}`}
                                checked={values.isDirect !== false}
                                onChange={(e) => onChangeKrValue(t.id, "isDirect", e.target.checked)}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <label
                                htmlFor={`is_direct_daily_${t.id}`}
                                className="text-[10px] font-semibold text-k-medium-grey"
                              >
                                Directly contribute to Weekly Task
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {(!weeklyPlanOptions || weeklyPlanOptions.length === 0) && (
              <p className="text-xs text-gray-400 italic text-center py-4">No Active Weekly Plans Found.</p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Description
          </label>
          <BulletTextarea
            value={description}
            onValueChange={onChangeDescription}
            placeholder="Add Some Details..."
            className="min-h-[88px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Day Of The Week
          </label>
          <select
            value={completionDay}
            onChange={(e) => onChangeCompletionDay(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select a Day...</option>
            {days.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
      <ApprovalFooter
        onCancel={onClose}
        onConfirm={onSubmit}
        confirmText={isEdit ? "Save Changes" : "Create Daily Plans"}
        confirmLoading={submitting}
        confirmDisabled={submitting || !title.trim() || ((selectedTaskIds?.length ?? 0) === 0 && !isEdit)}
      />
    </ModalLayout>
  );
}
