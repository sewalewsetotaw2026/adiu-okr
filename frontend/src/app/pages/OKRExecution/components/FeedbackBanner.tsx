import { useState } from "react";
import {
  MdClose,
  MdExpandMore,
  MdPersonOutline,
  MdAccessTime,
  MdComment,
  MdCheckCircle,
  MdHistory,
} from "react-icons/md";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export interface FeedbackBannerProps {
  status: string;
  reviewerName?: string;
  reviewerNote?: string;
  rejectionReason?: string;
  feedback_note?: string;
  targetTitle?: string; // NEW: The title of the specific plan/subtask
  submittedAt?: string;
  rejectedAt?: string;
  approvedAt?: string;
  timestamp?: string;
  onDismiss?: () => void;
}

export default function FeedbackBanner({
  status,
  reviewerName,
  reviewerNote,
  rejectionReason,
  feedback_note,
  targetTitle,
  submittedAt,
  rejectedAt,
  approvedAt,
  timestamp: providedTimestamp,
  isRevealed: providedIsRevealed,
  hideByDefault = false,
  onDismiss,
}: FeedbackBannerProps & { hideByDefault?: boolean; isRevealed?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRevealedInternal, setIsRevealedInternal] = useState(!hideByDefault);

  const isRevealed =
    providedIsRevealed !== undefined ? providedIsRevealed : isRevealedInternal;
  const showHistoryButton = providedIsRevealed === undefined && !isRevealed;

  // Determine the feedback to display
  const feedbackText = reviewerNote || rejectionReason || feedback_note;
  const hasReviewer = !!reviewerName;
  const timestamp = providedTimestamp || rejectedAt || approvedAt || submittedAt;

  // Only show if there's actual feedback
  if (!feedbackText) {
    return null;
  }

  // Handle hidden state (for History Mode)
  if (!isRevealed) {
    if (!showHistoryButton) return null;
    return (
      <div 
        className="mb-4 relative z-[30]"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsRevealedInternal(true);
            setIsExpanded(true); // Auto-expand when revealed
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-all text-[11px] font-bold uppercase tracking-wider group cursor-pointer shadow-sm active:scale-95 relative z-[31]"
        >
          <MdHistory className="text-sm group-hover:rotate-[-45deg] transition-transform duration-300" />
          View Feedback History
        </button>
      </div>
    );
  }

  // Different styling based on status
  const getStatusStyles = () => {
    const s = status.toUpperCase();
    switch (s) {
      case "REJECTED":
        return {
          bgColor: "bg-rose-50",
          borderColor: "border-rose-200",
          badgeBg: "bg-rose-100",
          badgeText: "text-rose-700",
          badgeBorder: "border-rose-300",
          iconColor: "text-rose-600",
          accentColor: "bg-rose-500",
          headerBg: "hover:bg-rose-100/50",
        };
      case "APPROVED":
        return {
          bgColor: "bg-emerald-50",
          borderColor: "border-emerald-200",
          badgeBg: "bg-emerald-100",
          badgeText: "text-emerald-700",
          badgeBorder: "border-emerald-300",
          iconColor: "text-emerald-600",
          accentColor: "bg-emerald-500",
          headerBg: "hover:bg-emerald-100/50",
        };
      case "UNDER_REVIEW":
        return {
          bgColor: "bg-amber-50",
          borderColor: "border-amber-200",
          badgeBg: "bg-amber-100",
          badgeText: "text-amber-700",
          badgeBorder: "border-amber-300",
          iconColor: "text-amber-600",
          accentColor: "bg-amber-500",
          headerBg: "hover:bg-amber-100/50",
        };
      case "DRAFT":
        return {
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
          badgeBg: "bg-orange-100",
          badgeText: "text-orange-700",
          badgeBorder: "border-orange-300",
          iconColor: "text-orange-600",
          accentColor: "bg-orange-500",
          headerBg: "hover:bg-orange-100/50",
        };
      default:
        return {
          bgColor: "bg-slate-50",
          borderColor: "border-slate-200",
          badgeBg: "bg-slate-100",
          badgeText: "text-slate-700",
          badgeBorder: "border-slate-300",
          iconColor: "text-slate-600",
          accentColor: "bg-slate-500",
          headerBg: "hover:bg-slate-100/50",
        };
    }
  };

  const styles = getStatusStyles();

  const getStatusLabel = () => {
    const s = status.toUpperCase();
    switch (s) {
      case "REJECTED":
        return "Changes Requested";
      case "APPROVED":
        return "Approved";
      case "UNDER_REVIEW":
        return "Under Review";
      case "DRAFT":
        return "Revision Needed";
      default:
        return status;
    }
  };

  return (
    <div
      className={`${styles.bgColor} border ${styles.borderColor} rounded-xl p-4 mb-4 transition-all duration-300 relative z-20 ${
        isExpanded ? "shadow-md ring-1 ring-black/5" : "shadow-sm"
      }`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header - Clickable */}
      <div
        className={`flex items-start justify-between gap-3 cursor-pointer p-2 -m-2 rounded-lg ${styles.headerBg} transition-colors duration-200`}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        <div className={`h-1.5 w-1.5 rounded-full ${styles.accentColor} mt-1.5`} />

        <div className="flex-1 min-w-0">
          {/* Status Badge & Target */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${styles.badgeBg} ${styles.badgeText} border ${styles.badgeBorder}`}
            >
              {status === "REJECTED" && <MdComment className="text-sm" />}
              {status === "APPROVED" && <MdCheckCircle className="text-sm" />}
              {getStatusLabel()}
            </span>
            {targetTitle && (
              <span className="text-xs font-medium text-slate-500 bg-white/60 px-2 py-1 rounded-lg border border-slate-100">
                On: <span className="text-slate-800">{targetTitle}</span>
              </span>
            )}
          </div>

          {/* Reviewer info */}
          {hasReviewer && (
            <div className="flex items-center gap-2 text-xs mb-2">
              <MdPersonOutline
                className={`${styles.iconColor} flex-shrink-0`}
              />
              <span className={`font-bold ${styles.badgeText} text-[10px] uppercase tracking-wider`}>
                Reviewer: {reviewerName}
              </span>
              {timestamp && (
                <>
                  <span className="text-slate-400">•</span>
                  <MdAccessTime
                    className={`${styles.iconColor} flex-shrink-0`}
                  />
                  <span className="text-slate-600">
                    {dayjs(timestamp).fromNow()}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Preview of feedback - truncated */}
          {!isExpanded && feedbackText && (
            <p className="text-sm text-slate-700 line-clamp-2 italic">
              "{feedbackText}"
            </p>
          )}
        </div>

        {/* Expand/Collapse Button */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className={`p-1 rounded-md transition-all duration-200 ${styles.headerBg}`}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <MdExpandMore
              className={`text-xl transition-transform duration-300 ${styles.iconColor} ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
          <button
            className="p-1 rounded-md hover:bg-black/5 transition-all duration-200 text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setIsRevealedInternal(false);
              onDismiss?.();
            }}
          >
            <MdClose className="text-lg" />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && feedbackText && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-10 pl-6 pr-2">
          <div className="space-y-2">
            <div className="flex gap-2">
              <MdComment
                className={`${styles.iconColor} flex-shrink-0 mt-0.5 text-lg`}
              />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                  Feedback from {reviewerName || "Reviewer"}
                  {targetTitle && (
                    <span className="normal-case font-normal text-slate-400">
                      for {targetTitle}
                    </span>
                  )}
                </p>
                <p
                  className={`text-sm leading-relaxed ${styles.badgeText} whitespace-pre-wrap break-words italic`}
                >
                  "{feedbackText}"
                </p>
              </div>
            </div>

            {/* Action hint */}
            <div className="mt-3 p-2 bg-white/50 rounded-lg">
              <p className="text-xs text-slate-600">
                💡 <span className="font-semibold">Tip:</span> Review the
                feedback above and{" "}
                {status === "REJECTED" || status === "DRAFT"
                  ? "make the necessary changes to resubmit your plan."
                  : "proceed with execution."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
