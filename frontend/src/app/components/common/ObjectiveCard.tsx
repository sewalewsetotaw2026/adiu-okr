import React, { ReactNode, useState } from "react";
import {
  MdExpandMore,
  MdFlag,
  MdPriorityHigh,
  MdCheckCircle,
} from "react-icons/md";

// Status types matched to the UI mockup
export type ObjectiveStatusValue =
  | "on_track"
  | "at_risk"
  | "not_started"
  | "completed"
  | "draft"
  | "published"
  | string;

export interface ObjectiveCardProps {
  id: string | number;
  title: string;
  status: ObjectiveStatusValue;
  progress: number;
  progressLabel?: string;
  ownerName?: ReactNode;
  krsCount?: number;
  departmentsLinkedCount?: number;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  headerContext?: ReactNode;
  expandable?: boolean;
  defaultExpanded?: boolean;
  onClick?: () => void;
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

export default function ObjectiveCard({
  id,
  title,
  status,
  progress,
  ownerName,
  krsCount,
  departmentsLinkedCount,
  actions,
  children,
  className = "",
  headerContext,
  expandable = false,
  defaultExpanded = false,
  onClick,
}: ObjectiveCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const statusStyles = getStatusStyles(status, progress);
  const clampedProgress = Math.min(100, Math.max(0, progress));

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

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 hover-premium ${
        (onClick || expandable) && !isExpanded ? "cursor-pointer" : ""
      } ${className}`}
    >
      {/* Header Container */}
      <div
        className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-5 flex-1 min-w-0 w-full">
          <div
            className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${statusStyles.iconBg} ${statusStyles.iconText} shadow-inner`}
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
              {/*<span className="text-slate-300 text-[10px] font-bold font-space uppercase tracking-widest">ID: {id}</span>*/}
            </div>

            <h3 className="text-xl font-bold text-slate-900 leading-tight tracking-tight mb-2 group-hover:text-primary transition-colors">
              {title}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {(krsCount !== undefined ||
                departmentsLinkedCount !== undefined) && (
                <span className="text-slate-400 text-xs font-bold font-space uppercase tracking-wider flex items-center gap-1.5">
                  {krsCount !== undefined && (
                    <span>
                      {krsCount}{" "}
                      <span className="font-medium text-slate-300">KRs</span>
                    </span>
                  )}
                  {krsCount !== undefined &&
                    departmentsLinkedCount !== undefined && (
                      <span className="text-slate-200">|</span>
                    )}
                  {departmentsLinkedCount !== undefined && (
                    <span>
                      {departmentsLinkedCount}{" "}
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

            {headerContext && (
              <div className="mt-3 text-sm text-slate-500 border-l-2 border-slate-100 pl-3 italic">
                {headerContext}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 sm:gap-10 justify-between w-full sm:w-auto shrink-0 mt-4 sm:mt-0 px-2 sm:px-0">
          <div className="text-right flex flex-col items-end gap-1">
            <div className="text-3xl font-black text-slate-900 tracking-tighter">
              {clampedProgress}
              <span className="text-lg text-slate-400 ml-0.5">%</span>
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
              className={`text-slate-400 rounded-xl p-2 transition-all duration-300 ${isExpanded ? "bg-primary/5 text-primary rotate-180" : "bg-slate-50 hover:bg-slate-100"}`}
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
            {children && (
              <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100/50">
                <div className="flex items-center justify-between mb-5 px-1">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] font-space flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-primary/20 rounded-full" />
                    Key Results
                  </h4>
                </div>
                {children}
              </div>
            )}
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
