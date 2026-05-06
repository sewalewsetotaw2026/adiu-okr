import { MdEdit, MdDelete, MdLock } from "react-icons/md";
import type { WeeklyPlan } from "../../../../types/okr.types";
import Button from "../../../components/Core/ui/Button";
import PlanStatusBadge from "./PlanStatusBadge";

const EDITABLE_STATUSES = new Set(["DRAFT", "REJECTED"]);

export interface WeeklyPlanCardProps {
  plan: WeeklyPlan;
  unit?: string;
  onEdit?: (plan: WeeklyPlan) => void;
  onDelete?: (plan: WeeklyPlan) => void;
}

export default function WeeklyPlanCard({
  plan,
  unit,
  onEdit,
  onDelete,
}: WeeklyPlanCardProps) {
  const editable = EDITABLE_STATUSES.has(plan.plan_status);
  const isPublished = plan.plan_status === "PUBLISHED" || plan.plan_status === "APPROVED";
  const rejected = plan.plan_status === "REJECTED";
  const progress = Math.max(0, Math.min(100, Number(plan.progress_pct ?? plan.final_score ?? 0)));
  const indirectProgress = Math.max(0, Math.min(100, Number(plan.indirect_score ?? 0)));
  const target = Number(plan.target_value ?? 0);
  const current = Number(plan.current_value ?? 0);
  const u = unit ?? "";

  return (
    <div 
      id={`focus-${plan.id}`}
      className="relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-5"
    >
      {!editable && (
        <span
          aria-label="Locked"
          className="absolute top-4 right-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200"
        >
          <MdLock className="text-base" />
        </span>
      )}

      <div className="flex items-start justify-between gap-3 mb-3 pr-9">
        <div className="min-w-0">
          <div className="text-[10px] font-black tracking-widest uppercase text-slate-400">
            Week {plan.week_number}
          </div>
          <h4 className="text-base font-bold text-slate-800 truncate">
            {plan.title}
          </h4>
        </div>
        <PlanStatusBadge status={plan.plan_status} />
      </div>

      {rejected && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-inset ring-rose-100">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Changes Requested
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mb-3">
        <div className="min-w-0">
          <span className="font-black tracking-widest uppercase text-[10px] text-slate-400 mr-1.5">
            Parent Key Result:
          </span>
          <span className="font-semibold text-slate-700 truncate">
            {plan.parent_monthly_plan?.title || "—"}
          </span>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] font-black tracking-widest uppercase text-slate-400 mb-1">
          <span>Progress</span>
          <div className="flex items-center gap-3">
            <span className="text-primary tabular-nums">Direct: {progress}%</span>
            <span className="text-slate-400 tabular-nums">Indirect: {indirectProgress}%</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {indirectProgress > 0 && (
            <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden opacity-50">
              <div
                className="h-full bg-slate-400 transition-all duration-500"
                style={{ width: `${indirectProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="text-slate-700 font-semibold tabular-nums">
          {current} / {target}
          {u ? ` ${u}` : ""}
        </div>
      </div>

      {(editable || isPublished) && (onEdit || onDelete) && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          {onEdit && (
            <Button
              variant="subtle"
              size="sm"
              icon={MdEdit}
              onClick={() => onEdit(plan)}
            >
              {editable ? "Edit" : "Request Edit"}
            </Button>
          )}
          {editable && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              icon={MdDelete}
              className="text-rose-600 hover:text-rose-700"
              onClick={() => onDelete(plan)}
            >
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
