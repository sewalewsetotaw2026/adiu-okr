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

interface DailyTaskCardProps {
  plan: DailyPlan & { _weeklyPlanTitle?: string };
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
  const [localCurrentValue, setLocalCurrentValue] = useState(plan.current_value);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Sync local value when plan prop changes
  useEffect(() => {
    setLocalCurrentValue(plan.current_value);
  }, [plan.current_value]);

  const range = plan.target_value - plan.start_value;
  const progressPct =
    range === 0
      ? localCurrentValue >= plan.target_value ? 100 : 0
      : Math.min(100, Math.max(0, ((localCurrentValue - plan.start_value) / range) * 100));

  const statusConfig: Record<DailyStatus, { label: string; color: string }> = {
    PENDING: { label: "Pending", color: "bg-slate-100 text-slate-600" },
    IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-600" },
    COMPLETED: { label: "Completed", color: "bg-green-100 text-green-600" },
    SKIPPED: { label: "Skipped", color: "bg-slate-200 text-slate-500" },
  };

  const isCompleted = plan.status === "COMPLETED";
  const isSkipped = plan.status === "SKIPPED";
  const isDone = isCompleted || isSkipped;

  return (
    <div
      id={`focus-${plan.id}`}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col"
    >
      {/* Card Header */}
      <div className="p-4 pb-0 flex justify-between items-start">
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${statusConfig[plan.status].color}`}
        >
          {statusConfig[plan.status].label}
        </span>

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
      <div className="p-4 pt-3 flex-1 flex flex-col">
        <h4
          className={`text-sm font-bold text-slate-800 mb-1 line-clamp-2 ${isSkipped ? "line-through text-slate-400" : ""}`}
        >
          {plan.title}
        </h4>
        <p className="text-[10px] text-slate-400 font-medium mb-3">
          {(plan as any)._weeklyPlanTitle || "Weekly Plan"}
        </p>

        {/* Metrics */}
        <div className="space-y-3 mt-auto">
          <div className="flex justify-between items-end text-[10px] font-bold">
            <div className="space-y-0.5">
              <span className="text-slate-400 block uppercase tracking-tighter">
                Target
              </span>
              <span className="text-slate-700">{plan.target_value}</span>
            </div>
            <div className="space-y-0.5 text-right">
              <span className="text-slate-400 block uppercase tracking-tighter">
                Current
              </span>
              <span className="text-primary">{localCurrentValue}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${isCompleted ? "bg-green-500" : "bg-primary"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-end">
              <span className="text-[10px] font-black text-slate-400">
                {Math.round(progressPct)}%
              </span>
            </div>
          </div>

          {/* Notes preview */}
          {plan.notes && (
            <p className="text-[10px] text-slate-400 italic line-clamp-1 border-t border-slate-50 pt-2">
              {plan.notes}
            </p>
          )}

          {/* Action Buttons — properly spaced, no overlap */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              icon={MdTrendingUp}
              fullWidth
              onClick={() => onOpenProgressModal(plan)}
              disabled={isDone}
            >
              Update
            </Button>

            <Button
              variant={isCompleted ? "ghost" : "secondary"}
              size="sm"
              icon={MdCheck}
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
