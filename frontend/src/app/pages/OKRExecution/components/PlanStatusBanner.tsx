import { useState } from "react";
import { MdHistory } from "react-icons/md";
import type { PlanStatus } from "../../../../types/okr.types";
import FeedbackBanner from "./FeedbackBanner";

export interface FeedbackItem {
  status: string;
  reviewerName?: string;
  feedbackNote?: string;
  targetTitle?: string;
  timestamp?: string;
}

/**
 * Banner shown at the top of a period section (month or week) once the
 * period has been submitted. Replaces the "Submit" button while in any
 * non-DRAFT state.
 */
export interface PlanStatusBannerProps {
  plan_status: PlanStatus;
  submitted_at?: string;
  approved_at?: string;
  published_at?: string;
  reviewer_name?: string;
  feedback_note?: string; // Legacy: for backward compatibility
  feedbackItems?: FeedbackItem[]; // NEW: List of all specific feedback
  className?: string;
  hideStatusBanner?: boolean; // NEW: Option to only show feedback items
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function PlanStatusBanner({
  plan_status,
  submitted_at,
  approved_at,
  published_at,
  reviewer_name,
  feedback_note,
  feedbackItems = [],
  className = "",
  hideStatusBanner = false,
}: PlanStatusBannerProps) {
  const [isHistoryRevealed, setIsHistoryRevealed] = useState(false);

  // If no specific feedback items provided, but a legacy feedback_note exists, wrap it.
  const normalizedFeedback = [...feedbackItems];
  if (normalizedFeedback.length === 0 && feedback_note) {
    normalizedFeedback.push({
      status: plan_status,
      reviewerName: reviewer_name,
      feedbackNote: feedback_note,
      timestamp: approved_at || submitted_at,
    });
  }

  // If in DRAFT with no feedback, we don't show the banner.
  if (plan_status === "DRAFT" && normalizedFeedback.length === 0) return null;

  const reviewer = reviewer_name?.trim() || "your reviewer";

  const variants: Record<
    PlanStatus,
    {
      icon: string;
      ring: string;
      bg: string;
      title: string;
      titleColor: string;
      body: React.ReactNode;
    }
  > = {
    DRAFT: {
      icon: "✍️",
      ring: "ring-orange-200",
      bg: "bg-orange-50",
      title: "REVISION NEEDED",
      titleColor: "text-orange-800",
      body: (
        <span className="text-orange-600">
          Your plan has feedback and is in draft. Review the notes below and resubmit.
        </span>
      ),
    },
    SUBMITTED: {
      icon: "🕐",
      ring: "ring-amber-200",
      bg: "bg-amber-50",
      title: "UNDER REVIEW",
      titleColor: "text-amber-800",
      body: (
        <span className="text-amber-900/80">
          Submitted {fmtDate(submitted_at)}. Awaiting review by{" "}
          <strong>{reviewer}</strong>. You cannot edit this plan until it is
          reviewed.
        </span>
      ),
    },
    UNDER_REVIEW: {
      icon: "🕐",
      ring: "ring-amber-200",
      bg: "bg-amber-50",
      title: "UNDER REVIEW",
      titleColor: "text-amber-800",
      body: (
        <span className="text-amber-900/80">
          Submitted {fmtDate(submitted_at)}. Awaiting review by{" "}
          <strong>{reviewer}</strong>. You cannot edit this plan until it is
          reviewed.
        </span>
      ),
    },
    APPROVED: {
      icon: "✅",
      ring: "ring-teal-200",
      bg: "bg-teal-50",
      title: "APPROVED",
      titleColor: "text-teal-800",
      body: (
        <span className="text-teal-900/80">
          Approved {fmtDate(approved_at)} by <strong>{reviewer}</strong>.
          Awaiting publication.
        </span>
      ),
    },
    PUBLISHED: {
      icon: "🟢",
      ring: "ring-emerald-200",
      bg: "bg-emerald-50",
      title: "PUBLISHED",
      titleColor: "text-emerald-800",
      body: (
        <span className="text-emerald-900/80">
          This plan is live and active. Published {fmtDate(published_at)}.
        </span>
      ),
    },
    REJECTED: {
      icon: "❌",
      ring: "ring-rose-200",
      bg: "bg-rose-50",
      title: "CHANGES REQUESTED",
      titleColor: "text-rose-800",
      body: (
        <div className="text-rose-900/80 space-y-2">
          <div>
            By <strong>{reviewer}</strong>.
          </div>
          <div className="text-xs">
            Review the comments, revise your plan, and resubmit.
          </div>
        </div>
      ),
    },
  };

  const v = variants[plan_status];


  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Status Banner */}
      {!hideStatusBanner && (
        <div
          className={`rounded-2xl ${v.bg} ring-1 ring-inset ${v.ring} px-5 py-4 flex items-start gap-4 transition-all duration-300 shadow-sm`}
        >
          <span className="text-2xl leading-none flex-shrink-0">{v.icon}</span>
          <div className="flex-1 min-w-0">
            <div
              className={`text-[11px] font-black tracking-widest uppercase ${v.titleColor} mb-1`}
            >
              {v.title}
            </div>
            <div className="text-sm font-medium">{v.body}</div>
          </div>
        </div>
      )}

      {/* Unified History Reveal Button */}
      {normalizedFeedback.length > 0 && !isHistoryRevealed && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setIsHistoryRevealed(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-all text-[11px] font-bold uppercase tracking-wider group cursor-pointer shadow-sm active:scale-95"
          >
            <MdHistory className="text-sm group-hover:rotate-[-45deg] transition-transform duration-300" />
            View Feedback History
          </button>
        </div>
      )}

      {/* Specific Feedback Items using FeedbackBanner */}
      {normalizedFeedback.length > 0 && isHistoryRevealed && (
        <div className="space-y-3 pl-4 border-l-2 border-slate-100 mt-2">
          {normalizedFeedback.map((item, idx) => (
            <FeedbackBanner
              key={idx}
              status={item.status}
              reviewerName={item.reviewerName}
              feedback_note={item.feedbackNote}
              targetTitle={item.targetTitle}
              timestamp={item.timestamp}
              isRevealed={true}
              onDismiss={() => setIsHistoryRevealed(false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
