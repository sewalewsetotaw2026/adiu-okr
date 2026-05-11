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

  const statusConfig: Record<DailyStatus, { label: string; color: string; dot: string }> = {
    PENDING: { label: "Pending", color: "bg-slate-50 text-slate-500 border-slate-200", dot: "bg-slate-400" },
    IN_PROGRESS: { label: "In Progress", color: "bg-blue-50 text-blue-600 border-blue-100", dot: "bg-blue-500" },
    COMPLETED: { label: "Completed", color: "bg-green-50 text-green-600 border-green-100", dot: "bg-green-500" },
    SKIPPED: { label: "Skipped", color: "bg-slate-100 text-slate-400 border-slate-200", dot: "bg-slate-300" },
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
      className={`group relative bg-white rounded-3xl border transition-all duration-500 flex flex-col overflow-hidden hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] ${
        isExpanded ? "ring-2 ring-primary/20 border-primary/20" : "border-slate-100 shadow-sm"
      }`}
    >
      {/* Glow Effect on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Card Header */}
      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${statusConfig[plan.status].color}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[plan.status].dot}`} />
              {statusConfig[plan.status].label}
            </span>
            {weeklyNumber != null && (
              <span className="px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-100">
                Week {weeklyNumber}
              </span>
            )}
          </div>

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

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-left w-full group/title"
        >
          <h4
            className={`text-lg font-black text-slate-800 mb-1 leading-tight tracking-tight group-hover/title:text-primary transition-colors ${isSkipped ? "line-through text-slate-400" : ""}`}
          >
            {plan.title}
          </h4>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
            {(plan as any)._weeklyPlanTitle || "Weekly Plan"}
          </p>
        </button>
      </div>

      {/* Card Body */}
      <div className="relative px-6 pb-6 space-y-5">
        {isMilestone ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => !isCompleted && onStatusChange(plan.id, "COMPLETED")}
              className={`flex flex-col items-center justify-center rounded-2xl py-4 border-2 transition-all duration-300 ${isCompleted
                ? "bg-green-50 border-green-200 text-green-700 shadow-lg shadow-green-500/10"
                : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50"
                }`}
              disabled={isSkipped || isCompleted}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">Achieved</span>
              {isCompleted && <MdCheck className="text-lg mt-1" />}
            </button>
            <button
              type="button"
              onClick={() => isCompleted && onStatusChange(plan.id, "PENDING")}
              className={`flex flex-col items-center justify-center rounded-2xl py-4 border-2 transition-all duration-300 ${!isCompleted && !isSkipped
                ? "bg-slate-50 border-slate-200 text-slate-600"
                : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50"
                }`}
              disabled={isSkipped || (!isCompleted && plan.status === "PENDING")}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">Incomplete</span>
              {!isCompleted && !isSkipped && (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2" />
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100/50">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] block mb-1">Target</span>
                <span className="text-lg font-black text-slate-700 tabular-nums">
                  {formatOkrNumber(plan.target_value)}
                  {plan.metricDefinition?.unit_of_measure && (
                    <span className="text-xs ml-1 text-slate-400 uppercase font-black">
                      {plan.metricDefinition.unit_of_measure}
                    </span>
                  )}
                </span>
              </div>
              <div className="rounded-2xl bg-primary/5 p-4 border border-primary/10 text-right">
                <span className="text-[9px] font-black text-primary/50 uppercase tracking-[0.1em] block mb-1">Current</span>
                <span className="text-lg font-black text-primary tabular-nums">
                  {formatOkrNumber(localCurrentValue)}
                  {plan.metricDefinition?.unit_of_measure && (
                    <span className="text-xs ml-1 text-primary/40 uppercase font-black">
                      {plan.metricDefinition.unit_of_measure}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Progress</span>
                <span className="text-primary">{formatOkrNumber(progressPct)}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full transition-all duration-1000 ease-out ${
                    isCompleted 
                      ? "bg-gradient-to-r from-green-400 to-green-600" 
                      : "bg-gradient-to-r from-primary/80 to-primary"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {plan.notes && (
                <p className="text-[11px] font-medium text-slate-500 italic truncate pt-1">
                  &ldquo;{plan.notes}&rdquo;
                </p>
              )}
            </div>
          </>
        )}

        <div className="pt-4 flex items-center gap-2 border-t border-slate-50">
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={(e) => { e.stopPropagation(); onOpenProgressModal(plan); }}
            disabled={isDone}
            className="rounded-xl font-black uppercase tracking-tight text-[10px] h-10! shadow-lg shadow-primary/20 px-2!"
          >
            Update Progress
          </Button>

          <Button
            variant={isCompleted ? "ghost" : "secondary"}
            size="sm"
            fullWidth
            onClick={(e) => { e.stopPropagation(); !isDone && setConfirmComplete(true); }}
            disabled={isDone}
            className={`rounded-xl font-black uppercase tracking-tight text-[10px] h-10! px-2! ${isCompleted ? "text-green-600" : ""}`}
          >
            {isCompleted ? "Done" : "Complete"}
          </Button>
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
        message={`"${plan.title}" will be marked as completed.`}
        confirmText="Complete"
        cancelText="Not yet"
        type="info"
        isLoading={completing}
      />
    </div>
  );
}
