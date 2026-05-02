import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";
import BulletTextarea from "../../../../components/common/BulletTextarea";

type MonthPlanOpt = { id: number; label: string };

type WeeklyPlanItem = {
  id: string;
  krId: number | "";
  metricId: number | "";
  blockers: string;
  tasks: Array<{ title: string; targetValue: number; currentValue: number }>;
  managerWeeklyPlanId?: number | "";
  isDirect: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  krOptions: Array<{ id: number; title: string; targetValue: number }>;
  
  weekNumber: number;
  onChangeWeekNumber: (n: number) => void;
  monthPlanOptions: MonthPlanOpt[];
  employeeMonthPlanId: number | "";
  onChangeEmployeeMonthPlanId: (id: number | "") => void;

  title: string;
  onChangeTitle: (v: string) => void;
  description: string;
  onChangeDescription: (v: string) => void;

  items: WeeklyPlanItem[];
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onChangeItem: (id: string, field: keyof WeeklyPlanItem, val: any) => void;

  metrics: Array<{ id: number; name: string; unit_of_measure?: string }>;
  alignmentOptions?: Array<{ id: number; title: string; targetValue: number; krTitle?: string }>;
  requireAlignment?: boolean;
  onSubmit: () => void;
  isEdit: boolean;
  submitting?: boolean;
};

/** M10 — Create / edit weekly plan with multi-KR support. */
export default function WeeklyPlanModal({
  isOpen,
  onClose,
  krOptions,
  weekNumber,
  onChangeWeekNumber,
  monthPlanOptions,
  employeeMonthPlanId,
  onChangeEmployeeMonthPlanId,
  title,
  onChangeTitle,
  description,
  onChangeDescription,
  items,
  onAddItem,
  onRemoveItem,
  onChangeItem,
  metrics,
  alignmentOptions = [],
  requireAlignment = false,
  onSubmit,
  isEdit,
  submitting,
}: Props) {
  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Weekly Plan" : "New Weekly Plan"}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Employee Month Plan
            </label>
            <select
              value={employeeMonthPlanId === "" ? "" : String(employeeMonthPlanId)}
              onChange={(e) => {
                const v = e.target.value;
                onChangeEmployeeMonthPlanId(v === "" ? "" : Number(v));
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select Month Plan...</option>
              {monthPlanOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Week #
            </label>
            <input
              type="number"
              min={1}
              max={13}
              value={weekNumber}
              onChange={(e) =>
                onChangeWeekNumber(Math.min(13, Math.max(1, Number(e.target.value) || 1)))
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Weekly Plan Title
          </label>
          <input
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="E.g., Week 1 Implementation..."
          />
        </div>

        <div className="flex justify-between items-end gap-4">
          <div className="flex-1">
             <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey uppercase tracking-wide opacity-0">
              Spacer
            </label>
            <button
              type="button"
              disabled={!employeeMonthPlanId}
              onClick={onAddItem}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition-all hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Weekly Item
            </button>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100">
           <label className="block text-xs font-semibold text-k-medium-grey tracking-wide">
            Weekly Plan Items
          </label>
          {items.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No Items Added. Click "Add Weekly Item" Above to Start.</p>
          ) : (
            <div className="space-y-8">
              {items.map((item) => {
                const kr = krOptions.find((o) => o.id === item.krId);
                const weeklyTarget = item.tasks?.reduce((sum, t) => sum + (t.targetValue || 0), 0) || 0;
                const weeklyInitial = item.tasks?.reduce((sum, t) => sum + (t.currentValue || 0), 0) || 0;
                
                return (
                  <div key={item.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/30 relative group">
                    {!isEdit && (
                       <button
                       type="button"
                       onClick={() => onRemoveItem(item.id)}
                       className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 shadow-sm flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                     >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                     </button>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-gray-400 tracking-wider">Target Monthly Plan Item</label>
                        <select
                          value={item.krId === "" ? "" : String(item.krId)}
                          onChange={(e) => onChangeItem(item.id, "krId", e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/10"
                        >
                          <option value="">Select KR...</option>
                          {krOptions.map((o) => (
                            <option key={o.id} value={o.id}>{o.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex justify-between items-center bg-primary/5 p-3 rounded-xl border border-primary/10">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-primary tracking-wider">Weekly Target (Sum of Tasks)</span>
                          <span className="text-sm font-bold text-k-dark-grey tabular-nums">{weeklyTarget}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-primary tracking-wider">Weekly Initial</span>
                          <span className="text-sm font-bold text-k-dark-grey tabular-nums">{weeklyInitial}</span>
                        </div>
                      </div>

                      {(requireAlignment || alignmentOptions.length > 0) && (
                        <div>
                          <label className="mb-1 flex items-center text-[10px] font-bold text-gray-400 tracking-wider">
                            Align To Manager Weekly Plan {requireAlignment && <span className="ml-1 text-red-500">*</span>}
                          </label>
                          <select
                            value={item.managerWeeklyPlanId === "" || item.managerWeeklyPlanId == null ? "" : String(item.managerWeeklyPlanId)}
                            onChange={(e) => onChangeItem(item.id, "managerWeeklyPlanId", e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/10"
                          >
                            <option value="">Select Manager Weekly Plan...</option>
                            {alignmentOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.title} (Target: {opt.targetValue}) {opt.krTitle ? `- ${opt.krTitle}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold text-gray-400 tracking-wider">Metric</label>
                          <select
                            value={item.metricId}
                            onChange={(e) => onChangeItem(item.id, "metricId", e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                          >
                            <option value="">Metric...</option>
                            {metrics.map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-primary tracking-wider">Potential Blockers / Notes</label>
                        <BulletTextarea
                          value={item.blockers}
                          onValueChange={(v) => onChangeItem(item.id, "blockers", v)}
                          className="min-h-[48px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                          placeholder="Specific Blockers For This KR..."
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`is_direct_${item.id}`}
                          checked={item.isDirect !== false}
                          onChange={(e) => onChangeItem(item.id, "isDirect", e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label
                          htmlFor={`is_direct_${item.id}`}
                          className="text-[11px] font-semibold text-k-medium-grey"
                        >
                          Directly contribute to parent Monthly Item
                        </label>
                      </div>

                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-[10px] font-bold text-gray-500 tracking-wider flex items-center gap-1.5">
                            Actionable Tasks
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newTasks = [...(item.tasks || []), { title: "", targetValue: 0, currentValue: 0 }];
                              onChangeItem(item.id, "tasks", newTasks);
                            }}
                            className="text-[10px] font-bold text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Task
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(item.tasks || []).map((t, idx) => (
                            <div key={idx} className="flex gap-2 items-start bg-white p-2 rounded-xl border border-gray-100 shadow-sm group/task">
                              <div className="flex-1 space-y-1.5">
                                <input
                                  value={t.title}
                                  onChange={(e) => {
                                    const newTasks = [...item.tasks];
                                    newTasks[idx] = { ...t, title: e.target.value };
                                    onChangeItem(item.id, "tasks", newTasks);
                                  }}
                                  className="w-full text-xs font-medium text-k-dark-grey bg-transparent outline-none border-b border-transparent focus:border-primary/30"
                                  placeholder="Task Title..."
                                />
                                <div className="flex gap-3">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-400 font-medium">Target:</span>
                                    <input
                                      type="number"
                                      value={t.targetValue}
                                      onChange={(e) => {
                                        const newTasks = [...item.tasks];
                                        newTasks[idx] = { ...t, targetValue: Number(e.target.value) };
                                        onChangeItem(item.id, "tasks", newTasks);
                                      }}
                                      className="w-12 text-[10px] bg-gray-50 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/20"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-400 font-medium">Current:</span>
                                    <input
                                      type="number"
                                      value={t.currentValue}
                                      onChange={(e) => {
                                        const newTasks = [...item.tasks];
                                        newTasks[idx] = { ...t, currentValue: Number(e.target.value) };
                                        onChangeItem(item.id, "tasks", newTasks);
                                      }}
                                      className="w-12 text-[10px] bg-gray-50 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/20"
                                    />
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newTasks = item.tasks.filter((_, i) => i !== idx);
                                  onChangeItem(item.id, "tasks", newTasks);
                                }}
                                className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover/task:opacity-100 p-1"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
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
            disabled={!employeeMonthPlanId}
            onClick={onAddItem}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/20 py-4 text-sm font-bold text-primary transition-all hover:bg-primary/5 hover:border-primary/40 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Another Weekly Item
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Global Notes (Optional)
          </label>
          <BulletTextarea
            value={description}
            onValueChange={onChangeDescription}
            className="min-h-[60px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Additional Context For The Whole Week..."
          />
        </div>
      </div>
      <ApprovalFooter
        onCancel={onClose}
        onConfirm={onSubmit}
        confirmText={isEdit ? "Save Changes" : "Create Plan"}
        confirmLoading={submitting}
        confirmDisabled={submitting || items.length === 0}
      />
    </ModalLayout>
  );
}
