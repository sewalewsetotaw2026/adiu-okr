import { useState } from "react";
import {
  MdEdit,
  MdDelete,
  MdLock,
  MdEditDocument,
  MdExpandMore,
} from "react-icons/md";
import type { WeeklyPlan } from "../../../../types/okr.types";
import Button from "../../../components/Core/ui/Button";
import PlanStatusBadge from "./PlanStatusBadge";
import FeedbackBanner from "./FeedbackBanner";
import { formatOkrNumber } from "../../../utils/okrNumber";

const EDITABLE_STATUSES = new Set(["DRAFT", "REJECTED"]);

export interface WeeklyPlanCardProps {
  plan: WeeklyPlan;
  unit?: string;
  onEdit?: (plan: WeeklyPlan) => void;
  onPostPublishEdit?: (plan: WeeklyPlan) => void;
  onDelete?: (plan: WeeklyPlan) => void;
  onUpdateProgress?: (plan: WeeklyPlan) => void;
}

export default function WeeklyPlanCard({
  plan,
  unit,
  onEdit,
  onPostPublishEdit,
  onDelete,
  onUpdateProgress,
}: WeeklyPlanCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const editable = EDITABLE_STATUSES.has(plan.plan_status);
  const isPublished = plan.plan_status === "PUBLISHED";
  const rejected = plan.plan_status === "REJECTED";
  const progress = Math.max(
    0,
    Math.min(100, Number(plan.progress_pct ?? plan.final_score ?? 0)),
  );
  const indirectProgress = Math.max(
    0,
    Math.min(100, Number(plan.indirect_score ?? 0)),
  );
  const target = Number(plan.target_value ?? 0);
  const current = Number(plan.current_value ?? 0);
  const u = unit ?? "";

  return (
    <div
      id={`focus-${plan.id}`}
      onClick={() => setIsExpanded((prev) => !prev)}
      className={`group relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 cursor-pointer overflow-hidden ${isExpanded ? "p-6" : "p-5"}`}
    >
      {/* Background Gradient Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />


      <div className="absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200 transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:ring-primary/20 shadow-sm">
        <MdExpandMore
          className={`text-xl transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
        />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4 pr-12">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            {!editable && (
              <span
                aria-label="Locked"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200"
              >
                <MdLock className="text-xs" />
              </span>
            )}
            <PlanStatusBadge status={plan.plan_status} size="xs" />
          </div>
          <h4 className="text-xl font-black text-slate-900 leading-tight tracking-tight group-hover:text-primary transition-colors duration-300">
            {plan.title}
          </h4>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="text-center">
            <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase block mb-0.5">
              Direct
            </span>
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="text-2xl font-black text-slate-900 tabular-nums tracking-tighter">
                {formatOkrNumber(progress)}
              </span>
              <span className="text-xs font-bold text-slate-400">%</span>
            </div>
          </div>

          {indirectProgress > 0 && (
            <div className="text-center">
              <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase block mb-0.5">
                Indirect
              </span>
              <div className="flex items-baseline justify-center gap-0.5">
                <span className="text-2xl font-black text-slate-500/80 tabular-nums tracking-tighter">
                  {formatOkrNumber(indirectProgress)}
                </span>
                <span className="text-xs font-bold text-slate-300">%</span>
              </div>
            </div>
          )}

          <div className="h-8 w-px bg-slate-100 hidden md:block" />

          <div className="text-right">
            <span className="text-[9px] font-black tracking-widest text-primary/60 uppercase block mb-0.5">
              Target Met
            </span>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-xl font-black text-primary tabular-nums tracking-tight">
                {formatOkrNumber(current)}
              </span>
              <span className="text-[10px] font-bold text-slate-300">/</span>
              <span className="text-sm font-bold text-slate-500 tabular-nums">
                {formatOkrNumber(target)}
              </span>
              {u && (
                <span className="text-[10px] font-bold text-slate-400 ml-0.5 uppercase tracking-tighter">
                  {u}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {rejected && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-inset ring-rose-100">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Changes Requested
        </div>
      )}

      {/* Feedback Banner - Only show directly on card if REJECTED. Approved/Published feedback is in the unified top banner. */}
      {plan.plan_status === "REJECTED" && (
        <FeedbackBanner
          status={plan.plan_status}
          reviewerName={plan.reviewer_name}
          targetTitle={plan.title}
          timestamp={plan.approved_at || plan.submitted_at}
          reviewerNote={
            plan.reviewer_note || plan.rejection_reason || plan.feedback_note
          }
        />
      )}

      {isExpanded && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mb-3">
            <div className="min-w-0">
              <span className="font-black tracking-widest uppercase text-[10px] text-slate-400 mr-1.5">
                Parent Key Result:
              </span>
              <span className="font-semibold text-slate-700 truncate">
                {plan.parent_monthly_plan?.parent_kr_title || "—"}
              </span>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between text-[10px] font-black tracking-widest uppercase text-slate-400 mb-1">
              <span>Progress</span>
              <div className="flex items-center gap-3">
                <span className="text-primary tabular-nums">
                  Direct: {formatOkrNumber(progress)}%
                </span>
                <span className="text-slate-400 tabular-nums">
                  Indirect: {formatOkrNumber(indirectProgress)}%
                </span>
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
              {formatOkrNumber(current)} / {formatOkrNumber(target)}
              {u ? ` ${u}` : ""}
            </div>
          </div>

          {(editable || isPublished) &&
            (onEdit || onPostPublishEdit || onDelete) && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                {editable && onEdit && (
                  <Button
                    variant="subtle"
                    size="sm"
                    icon={MdEdit}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(plan);
                    }}
                  >
                    Edit
                  </Button>
                )}
                {isPublished && onPostPublishEdit && (
                  <Button
                    variant="white"
                    size="sm"
                    icon={MdEditDocument}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPostPublishEdit(plan);
                    }}
                    className="h-7! px-3! text-[10px]! font-black uppercase tracking-widest text-primary border border-primary/20 hover:bg-primary/5 hover:border-primary/40 shadow-sm transition-all duration-300"
                  >
                    Edit Published
                  </Button>
                )}
                {isPublished && onUpdateProgress && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateProgress(plan);
                    }}
                  >
                    Update Progress
                  </Button>
                )}
                {editable && onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={MdDelete}
                    className="text-rose-600 hover:text-rose-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(plan);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            )}
        </>
      )}
    </div>
  );
}
