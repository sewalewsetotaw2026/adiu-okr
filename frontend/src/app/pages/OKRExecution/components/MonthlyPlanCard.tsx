import { useState } from "react";
import {
  MdEdit,
  MdDelete,
  MdLock,
  MdEditDocument,
  MdExpandMore,
  MdAccountTree,
} from "react-icons/md";
import type { MonthlyPlan } from "../../../../types/okr.types";
import Button from "../../../components/Core/ui/Button";
import PlanStatusBadge from "./PlanStatusBadge";
import FeedbackBanner from "./FeedbackBanner";
import { formatOkrNumber } from "../../../utils/okrNumber";
import ConfidenceBadge from "../../../components/common/ConfidenceBadge";
import { resolveConfidenceLevel } from "../../../utils/okrApi";
import type { ConfidenceLevel } from "../../../constants/themeConstants";

const EDITABLE_STATUSES = new Set(["DRAFT", "REJECTED"]);

export interface MonthlyPlanCardProps {
  plan: MonthlyPlan;
  unit?: string;
  onEdit?: (plan: MonthlyPlan) => void;
  onPostPublishEdit?: (plan: MonthlyPlan) => void;
  onDelete?: (plan: MonthlyPlan) => void;
  onUpdateProgress?: (plan: MonthlyPlan) => void;
  /** Pre-computed confidence level. If not provided, derived from plan.progress_pct. */
  confidenceLevel?: ConfidenceLevel;
}

export default function MonthlyPlanCard({
  plan,
  unit,
  onEdit,
  onPostPublishEdit,
  onDelete,
  onUpdateProgress,
  confidenceLevel: confidenceLevelProp,
}: MonthlyPlanCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  const [isParentTitleExpanded, setIsParentTitleExpanded] = useState(false);
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
  const u = unit || plan.parent_key_result?.unit || "";
  // Derive confidence from progress if not explicitly provided
  const confidenceLevel =
    confidenceLevelProp !== undefined
      ? confidenceLevelProp
      : resolveConfidenceLevel(progress);

  return (
    <div
      id={`focus-${plan.id}`}
      onClick={() => setIsExpanded((prev) => !prev)}
      className={`group relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 cursor-pointer overflow-hidden ${isExpanded ? "p-6" : "p-5"}`}
    >
      {/* Background Gradient Effect */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/0 to-primary/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Lock badge for non-editable statuses */}

      <div className="absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200 transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:ring-primary/20 shadow-sm">
        <MdExpandMore
          className={`text-xl transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
        />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pr-12">
        {/* LEFT SECTION */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {!editable && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                <MdLock className="text-xs" />
              </span>
            )}
            <PlanStatusBadge status={plan.plan_status} size="xs" />
            <ConfidenceBadge level={confidenceLevel} size="xs" />
          </div>

          <div className="relative">
            <h4
              className={`text-base font-semibold text-slate-800 tracking-tight group-hover:text-primary transition-colors duration-300 ${
                !isTitleExpanded ? "line-clamp-2" : ""
              }`}
            >
              {plan.title}
            </h4>
            {plan.title.length > 80 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTitleExpanded(!isTitleExpanded);
                }}
                className="text-primary text-[9px] font-bold uppercase tracking-wider hover:underline mt-1"
              >
                {isTitleExpanded ? "Show Less" : "Read More"}
              </button>
            )}

            {plan.parent_key_result?.title && (
              <div className="mt-2 group/parent">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                  Parent Key Result
                </span>
                <div
                  className={`text-xs font-semibold text-slate-600 ${
                    !isParentTitleExpanded ? "line-clamp-1" : ""
                  }`}
                >
                  {plan.parent_key_result.title}
                </div>
                {plan.parent_key_result.title.length > 80 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsParentTitleExpanded(!isParentTitleExpanded);
                    }}
                    className="text-primary text-[9px] font-bold uppercase tracking-wider hover:underline mt-1"
                  >
                    {isParentTitleExpanded ? "Show Less" : "Read More"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SECTION (COMPACT KPI GRID) */}
        <div className="flex items-center gap-5 shrink-0">

        {/* DIRECT */}
        <div className="text-center min-w-15">
          <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase block mb-0.5">
            Direct
          </span>
          <div className="flex items-baseline justify-center gap-0.5">
            <span className="text-xl font-black text-slate-900 tabular-nums">
              {formatOkrNumber(progress)}
            </span>
            <span className="text-xs font-bold text-slate-400">%</span>
          </div>
        </div>

        {/* INDIRECT */}
        {indirectProgress > 0 && (
          <div className="text-center min-w-15">
            <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase block mb-0.5">
              Indirect
            </span>
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="text-xl font-black text-slate-500/80 tabular-nums">
                {formatOkrNumber(indirectProgress)}
              </span>
              <span className="text-xs font-bold text-slate-300">%</span>
            </div>
          </div>
        )}

        {/* DIVIDER */}
        <div className="h-7 w-px bg-slate-100" />

        {/* CURRENT / TARGET (NEW STRUCTURE) */}
        <div className="text-right min-w-27.5">
          <span className="text-[9px] font-bold tracking-widest text-primary/60 uppercase block mb-0.5">
            Progress (Current / Target)
          </span>

          <div className="flex items-baseline justify-end gap-1">
            <span className="text-sm font-semibold text-slate-600 tabular-nums whitespace-nowrap">
              {formatOkrNumber(current)}
            </span>

            <span className="text-[10px] font-bold text-slate-300">/</span>

            <span className="text-sm font-semibold text-slate-600 tabular-nums whitespace-nowrap">
              {formatOkrNumber(target)}
            </span>

            {u && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-0.5">
                {u}
              </span>
            )}
          </div>
        </div>

      </div>
      </div>

      {/* Rejected chip */}
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

      {/* Parent Key Result */}
      {isExpanded && (
        <>
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

          {/* Values */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="text-slate-700 font-semibold tabular-nums">
              {formatOkrNumber(current)} / {formatOkrNumber(target)}
              {u ? ` ${u}` : ""}
            </div>
          </div>

          {/* Aligned manager plan */}
          {plan.aligned_manager_plan_title && (
            <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/10 px-3 py-2 mt-1">
              <MdAccountTree className="text-primary/60 shrink-0 mt-0.5" style={{ fontSize: 14 }} />
              <div className="min-w-0">
                <span className="text-[9px] font-black tracking-widest uppercase text-primary/50 block mb-0.5">Aligned Manager Plan</span>
                <span className="text-xs font-semibold text-slate-700 truncate block">{plan.aligned_manager_plan_title}</span>
              </div>
            </div>
          )}

          {/* Actions */}
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
        </>
      )}
    </div>
  );
}
