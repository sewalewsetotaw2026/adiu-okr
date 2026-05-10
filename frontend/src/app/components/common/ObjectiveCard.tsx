import React, { ReactNode, useState } from "react";
import {
  MdExpandMore,
  MdFlag,
  MdPriorityHigh,
  MdCheckCircle,
} from "react-icons/md";
import KeyResultListItem from "./KeyResultListItem";
import { formatOkrCount, formatOkrNumber } from "../../utils/okrNumber";
import FeedbackBanner from "../../pages/OKRExecution/components/FeedbackBanner";

// Status types matched to the UI mockup
export type ObjectiveStatusValue =
  | "on_track"
  | "at_risk"
  | "not_started"
  | "completed"
  | "draft"
  | "published"
  | string;

export interface ObjectiveData {
  id: string | number;
  title: string;
  description?: string;
  ownerName?: ReactNode;
  progress: number;
  indirectProgress?: number;
  status: ObjectiveStatusValue;
  krCount?: number;
  departmentsLinkedCount?: number;
}

export interface ObjectiveCardProps {
  objective?: ObjectiveData;
  id?: string | number;
  title?: string;
  status?: string;
  progress?: number;
  indirectProgress?: number;
  progressLabel?: string;
  krCount?: number;
  krsCount?: number;
  departmentsLinkedCount?: number;
  description?: string;
  ownerName?: ReactNode;
  headerContext?: ReactNode;
  children?: ReactNode;

  keyResults?: any[];
  variant?: "admin" | "manager" | "employee";
  actions?: ReactNode;
  className?: string;
  expandable?: boolean;
  defaultExpanded?: boolean;
  onClick?: (e?: React.MouseEvent) => void;
  showId?: boolean;
  onDecomposeKR?: (krId: number, title: string) => void;
  feedbackNote?: string;
  reviewerName?: string;
}

function getStatusStyles(status: string, progress: number = 0) {
  const s = status.toLowerCase();

  if (
    s === "published" ||
    s === "on_track" ||
    (s === "open" && progress >= 50)
  ) {
    return {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-600",
      label: s === "published" ? "Published" : "On Track",
    };
  }

  if (s === "at_risk" || (s === "open" && progress < 50 && progress > 0)) {
    return {
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-500",
      iconBg: "bg-amber-100",
      iconText: "text-amber-600",
      label: "At Risk",
    };
  }

  if (s === "completed" || progress >= 100) {
    return {
      bg: "bg-sky-50",
      text: "text-sky-700",
      dot: "bg-sky-500",
      iconBg: "bg-sky-100",
      iconText: "text-sky-600",
      label: "Completed",
    };
  }

  if (s === "not_started" || s === "draft") {
    return {
      bg: "bg-slate-100",
      text: "text-slate-500",
      dot: "bg-slate-400",
      iconBg: "bg-slate-100",
      iconText: "text-slate-500",
      label: s === "draft" ? "Draft" : "Not Started",
    };
  }

  return {
    bg: "bg-primary/5",
    text: "text-primary",
    dot: "bg-primary",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
    label: status.replace("_", " "),
  };
}

export default function ObjectiveCard(props: ObjectiveCardProps) {
  const {
    objective,
    keyResults = [],
    actions,
    className = "",
    expandable = false,
    defaultExpanded = false,
    onClick,
    showId = true,
    onDecomposeKR,
    progressLabel = "Overall Progress",
  } = props;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const id = objective?.id ?? props.id ?? "";
  const title = objective?.title ?? props.title ?? "";
  const status = objective?.status ?? props.status ?? "draft";
  const progress = objective?.progress ?? props.progress ?? 0;
  const indirectProgress =
    objective?.indirectProgress ?? props.indirectProgress ?? 0;
  const ownerName = objective?.ownerName ?? props.ownerName;
  const krCount = objective?.krCount ?? props.krCount ?? props.krsCount;
  const departmentsLinkedCount =
    objective?.departmentsLinkedCount ?? props.departmentsLinkedCount;
  const description = objective?.description ?? props.description;
  const feedbackNote = props.feedbackNote;
  const reviewerName = props.reviewerName;

  const statusStyles = getStatusStyles(status, progress);
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const clampedIndirectProgress = Math.min(100, Math.max(0, indirectProgress));

  const IconComponent =
    clampedProgress >= 100
      ? MdCheckCircle
      : statusStyles.label === "At Risk"
        ? MdPriorityHigh
        : MdFlag;

  const handleToggle = (e: React.MouseEvent) => {
    if (expandable) {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    } else if (onClick) {
      onClick();
    }
  };

  const variantStyles = "border-slate-100 shadow-sm shadow-slate-200/50";

  return (
    <div
      className={`bg-white rounded-2xl border ${variantStyles} shadow-sm overflow-hidden transition-all duration-300 hover-premium group ${
        onClick || expandable
          ? "cursor-pointer hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 hover:bg-primary/5 hover:-translate-y-1"
          : ""
      } ${className}`}
    >
      <div
        className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-5 flex-1 min-w-0 w-full">
          <div
            className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${statusStyles.iconBg} ${statusStyles.iconText} shadow-inner`}
          >
            <IconComponent className="text-3xl" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`${statusStyles.text} ${statusStyles.bg} text-[9px] font-black uppercase tracking-[0.2em] font-space px-2 py-0.5 rounded-lg border border-current/10`}
              >
                {statusStyles.label}
              </span>
            </div>

            <h3 className="text-xl font-bold text-slate-900 leading-tight tracking-tight mb-2 group-hover:text-primary transition-colors">
              {title}
            </h3>

            {props.headerContext && (
              <div className="mb-2 text-sm text-slate-500">
                {props.headerContext}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {(krCount !== undefined ||
                departmentsLinkedCount !== undefined) && (
                <span className="text-slate-400 text-xs font-bold font-space uppercase tracking-wider flex items-center gap-1.5">
                  {krCount !== undefined && (
                    <span>
                      {formatOkrCount(krCount)}{" "}
                      <span className="font-medium text-slate-300">
                        Key Results
                      </span>
                    </span>
                  )}
                  {krCount !== undefined &&
                    departmentsLinkedCount !== undefined && (
                      <span className="text-slate-200">|</span>
                    )}
                  {departmentsLinkedCount !== undefined && (
                    <span>
                      {formatOkrCount(departmentsLinkedCount)}{" "}
                      <span className="font-medium text-slate-300">Depts</span>
                    </span>
                  )}
                </span>
              )}

              {ownerName && (
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                  <span>
                    Owner:{" "}
                    <span className="text-slate-600 font-bold">
                      {ownerName}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {description && (
              <div className="mt-3 text-sm text-slate-500 border-l-2 border-slate-100 pl-3 italic">
                {description}
              </div>
            )}

            <FeedbackBanner
              status={status}
              reviewerName={reviewerName}
              feedback_note={feedbackNote}
              targetTitle={title}
              hideByDefault={
                status.toLowerCase() === "published" ||
                status.toLowerCase() === "on_track" ||
                status.toLowerCase() === "completed"
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-6 sm:gap-10 justify-between w-full sm:w-auto shrink-0 mt-4 sm:mt-0 px-2 sm:px-0">
          <div className="text-right flex flex-col items-end gap-1">
            {progressLabel && (
              <span className="text-[10px] font-black tracking-widest text-slate-400 font-space uppercase mb-1">
                {progressLabel}
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-black text-slate-900 tracking-tighter">
                  {formatOkrNumber(clampedProgress)}
                  <span className="text-sm text-slate-400 ml-0.5">%</span>
                </div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  Direct
                </div>
              </div>
              {indirectProgress > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900 tracking-tighter">
                    {formatOkrNumber(clampedIndirectProgress)}
                    <span className="text-sm text-slate-400 ml-0.5">%</span>
                  </div>
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    Indirect
                  </div>
                </div>
              )}
            </div>
            <div className="w-24 sm:w-40 bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 shadow-inner">
              <div
                className={`${statusStyles.dot} h-full rounded-full transition-all duration-1000 ease-out liquid-progress shadow-[0_0_12px_rgba(0,0,0,0.1)]`}
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
          </div>

          {expandable && (
            <div
              className={`text-slate-400 rounded-xl p-2 transition-all duration-300 ${isExpanded ? "bg-primary/5 text-primary rotate-180" : "bg-slate-50 hover:bg-primary/10"}`}
            >
              <MdExpandMore className="text-2xl" />
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content Area */}
      {expandable && isExpanded && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="px-6 pb-6">
            {props.children ? (
              props.children
            ) : keyResults && keyResults.length > 0 ? (
              <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100/50">
                <div className="flex items-center justify-between mb-5 px-1">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] font-space flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-primary/20 rounded-full" />
                    Key Results
                  </h4>
                </div>
                <div className="flex flex-col gap-4">
                  {keyResults.map((kr: any, index: number) => {
                    const krTgt = Number(kr.target_value ?? 0);
                    const krCur = Number(
                      kr.current_value ??
                        kr.currentValue ??
                        kr.final_value ??
                        0,
                    );
                    const directRaw =
                      kr.final_score ??
                      kr.progress_percent ??
                      kr.progress_pct ??
                      kr.progress;
                    const krPct =
                      directRaw != null
                        ? Number(directRaw)
                        : krTgt > 0
                          ? Number(((krCur / krTgt) * 100).toFixed(2))
                          : 0;
                    const krIndirectPct = Number(
                      kr.indirect_score ??
                        kr.indirect_score_percent ??
                        kr.indirectProgress ??
                        0,
                    );
                    return (
                      <KeyResultListItem
                        key={kr.id}
                        title={kr.title}
                        index={index}
                        progress={krPct}
                        indirectProgress={krIndirectPct}
                        status={kr.status_code || kr.status || "draft"}
                        targetString={`${formatOkrNumber(krCur)} / ${formatOkrNumber(krTgt)}${kr.unit_of_measure ? (kr.unit_of_measure === "%" ? "%" : ` ${kr.unit_of_measure}`) : ""}`}
                        metricTypeString={`Weight: ${formatOkrNumber(kr.weight_percent ?? 0)}%`}
                        feedbackNote={kr.feedbackNote}
                        reviewerName={kr.reviewerName}
                        actions={
                          onDecomposeKR && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDecomposeKR(kr.id, kr.title);
                              }}
                              className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                            >
                              Add Decomposition
                            </button>
                          )
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {actions && (
            <div className="px-6 py-5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap gap-3 justify-end items-center">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Fallback for non-expandable cards */}
      {!expandable && actions && (
        <div className="px-6 py-5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap gap-3 justify-end items-center">
          {actions}
        </div>
      )}
    </div>
  );
}
