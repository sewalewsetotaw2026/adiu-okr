import { useState, useEffect } from "react";
import {
  MdCheck,
  MdTrendingUp,
  MdEdit,
  MdDelete,
  MdBlock,
} from "react-icons/md";
import Button from "../../../components/Core/ui/Button";
import type { DailyPlan, DailyStatus } from "../../../../types/okr.types";
import ActionMenu from "../../../components/common/ActionMenu";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import { formatOkrNumber } from "../../../utils/okrNumber";

interface DailyTaskCardProps {
  plan: DailyPlan & { _weeklyPlanTitle?: string; _plannedDate?: string };
  onOpenProgressModal: (plan: DailyPlan) => void;
  onStatusChange: (id: string, status: DailyStatus) => Promise<void>;
  onEdit: (plan: DailyPlan) => void;
  onDelete: (plan: DailyPlan) => void;
}

export default function DailyTaskCard({
  plan,
  onOpenProgressModal,
  onStatusChange,
  onEdit,
  onDelete,
}: DailyTaskCardProps) {
  const [localCurrentValue, setLocalCurrentValue] = useState(
    plan.current_value,
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Sync local value when plan prop changes
  useEffect(() => {
    setLocalCurrentValue(plan.current_value);
  }, [plan.current_value]);

  const range = plan.target_value - plan.start_value;
  const progressPct =
    range === 0
      ? localCurrentValue >= plan.target_value
        ? 100
        : 0
      : Math.min(
        100,
        Math.max(0, ((localCurrentValue - plan.start_value) / range) * 100),
      );

  const statusConfig: Record<DailyStatus, { label: string; color: string }> = {
    PENDING: { label: "Pending", color: "bg-slate-100 text-slate-600" },
    IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-600" },
    COMPLETED: { label: "Completed", color: "bg-green-100 text-green-600" },
    SKIPPED: { label: "Skipped", color: "bg-slate-200 text-slate-500" },
  };

  const isCompleted = plan.status === "COMPLETED";
  const isSkipped = plan.status === "SKIPPED";
  const isDone = isCompleted || isSkipped;
  const isMilestone =
    plan.metricDefinition?.category === "MILESTONE"
  const weeklyNumber = (plan as any)._weeklyPlanNumber;
  const monthlyNumber = (plan as any)._monthlyPlanNumber;

  return (
    <div
      id={`focus-${plan.id}`}
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden ${isExpanded ? "ring-1 ring-primary/10" : ""}`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${statusConfig[plan.status].color}`}
            >
              {statusConfig[plan.status].label}
            </span>
            {weeklyNumber != null && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide">
                Target Week {weeklyNumber}
              </span>
            )}
            {monthlyNumber != null && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wide">
                Target Month {monthlyNumber}
              </span>
            )}
          </div>
          <h4
            className={`text-sm font-bold text-slate-800 mb-1 line-clamp-2 ${isSkipped ? "line-through text-slate-400" : ""}`}
          >
            {plan.title}
          </h4>
          <p className="text-[10px] text-slate-400 font-medium">
            {(plan as any)._weeklyPlanTitle || "Weekly Plan"}
          </p>
          {(plan as any)._plannedDate && (
            <p className="mt-1 text-[10px] font-semibold text-primary/80">
              {String((plan as any)._plannedDate)}
            </p>
          )}
        </button>

        <ActionMenu
          actions={
            [
              {
                label: "Mark as Skipped",
                icon: <MdBlock />,
                value: "skip",
                onClick: () => onStatusChange(plan.id, "SKIPPED"),
                hidden: isDone,
              },
              {
                label: "Edit Task",
                icon: <MdEdit />,
                value: "edit",
                onClick: () => onEdit(plan),
              },
              {
                label: "Delete Task",
                icon: <MdDelete />,
                value: "delete",
                onClick: () => onDelete(plan),
                variant: "danger",
              },
            ].filter((a) => !a.hidden) as any
          }
        />
      </div>

      {/* Card Body */}
      <div
        className={`${isExpanded ? "p-4 pt-0" : "px-4 pb-4 pt-0"} flex-1 flex flex-col gap-3`}
      >
        {isMilestone ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => !isCompleted && onStatusChange(plan.id, "COMPLETED")}
              className={`flex flex-col items-center justify-center rounded-xl py-2.5 border-2 transition-all ${isCompleted
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                }`}
              disabled={isSkipped || isCompleted}
            >
              <span className="text-[10px] font-black uppercase tracking-wider">
                Achieved
              </span>
              {isCompleted && <MdCheck className="text-xs mt-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => isCompleted && onStatusChange(plan.id, "PENDING")}
              className={`flex flex-col items-center justify-center rounded-xl py-2.5 border-2 transition-all ${!isCompleted && !isSkipped
                ? "bg-slate-50 border-slate-200 text-slate-600"
                : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                }`}
              disabled={isSkipped || (!isCompleted && plan.status === "PENDING")}
            >
              <span className="text-[10px] font-black uppercase tracking-wider">
                Not Achieved
              </span>
              {!isCompleted && !isSkipped && (
                <div className="w-1 h-1 rounded-full bg-slate-400 mt-1" />
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-[10px] font-bold">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-400 block uppercase tracking-tighter">
                  Target
                </span>
                <span className="text-slate-700 tabular-nums">
                  {formatOkrNumber(plan.target_value)}
                  {plan.metricDefinition?.unit_of_measure && (
                    <span className="text-[10px] ml-0.5 text-slate-400 font-bold uppercase">
                      {plan.metricDefinition.unit_of_measure === "%"
                        ? "%"
                        : ` ${plan.metricDefinition.unit_of_measure}`}
                    </span>
                  )}
                </span>
              </div>
              <div className="rounded-xl bg-primary/5 px-3 py-2 text-right">
                <span className="text-slate-400 block uppercase tracking-tighter">
                  Current
                </span>
                <span className="text-primary tabular-nums">
                  {formatOkrNumber(localCurrentValue)}
                  {plan.metricDefinition?.unit_of_measure && (
                    <span className="text-[10px] ml-0.5 text-primary/60 font-bold uppercase">
                      {plan.metricDefinition.unit_of_measure === "%"
                        ? "%"
                        : ` ${plan.metricDefinition.unit_of_measure}`}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${isCompleted ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
                <span className="tabular-nums">
                  {formatOkrNumber(progressPct)}%
                </span>
                {plan.notes ? (
                  <span className="truncate max-w-[70%] italic">
                    {plan.notes}
                  </span>
                ) : (
                  <span />
                )}
              </div>
            </div>
          </>
        )}

        <div className="pt-0 space-y-2 border-t border-slate-50">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={() => onOpenProgressModal(plan)}
              disabled={isDone}
            >
              Update Progress
            </Button>

            <Button
              variant={isCompleted ? "ghost" : "secondary"}
              size="sm"
              fullWidth
              onClick={() => !isDone && setConfirmComplete(true)}
              disabled={isDone}
            >
              {isCompleted ? "Done" : "Complete"}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={async () => {
          setCompleting(true);
          await onStatusChange(plan.id, "COMPLETED");
          setCompleting(false);
          setConfirmComplete(false);
        }}
        title="Mark task as complete?"
        message={`"${plan.title}" will be marked as completed. This cannot be undone.`}
        confirmText="Complete"
        cancelText="Not yet"
        type="info"
        isLoading={completing}
      />
    </div>
  );
}
