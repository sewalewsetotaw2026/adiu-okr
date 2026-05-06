import type { PlanStatus } from "../../../../types/okr.types";

/**
 * Banner shown at the top of a period section (month or week) once the
 * period has been submitted. Replaces the "Submit" button while in any
 * non-DRAFT state.
 *
 * Variants per spec (Task 4 of Packet 2):
 *   SUBMITTED / UNDER_REVIEW → 🕐 amber, "Under review by …"
 *   APPROVED                → ✅ teal, "Approved by …"
 *   PUBLISHED               → 🟢 green, "Live and active"
 *   REJECTED                → ❌ red, "Changes requested"
 */
export interface PlanStatusBannerProps {
  plan_status: PlanStatus;
  submitted_at?: string;
  approved_at?: string;
  published_at?: string;
  reviewer_name?: string;
  feedback_note?: string;
  onViewFeedback?: () => void;
  className?: string;
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
  onViewFeedback,
  className = "",
}: PlanStatusBannerProps) {
  if (plan_status === "DRAFT") return null;

  const reviewer = reviewer_name?.trim() || "your reviewer";

  const variants: Record<
    Exclude<PlanStatus, "DRAFT">,
    {
      icon: string;
      ring: string;
      bg: string;
      title: string;
      titleColor: string;
      body: React.ReactNode;
    }
  > = {
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
          {feedback_note ? (
            <div className="bg-white/70 rounded-lg px-3 py-2 text-rose-900 text-xs italic ring-1 ring-rose-100">
              "{feedback_note}"
            </div>
          ) : null}
          <div className="text-xs">
            Review comments below, revise your plan, and resubmit.
            {onViewFeedback ? (
              <button
                type="button"
                onClick={onViewFeedback}
                className="ml-2 inline-flex items-center gap-1 text-rose-700 hover:text-rose-900 font-bold underline"
              >
                View ↓
              </button>
            ) : null}
          </div>
        </div>
      ),
    },
  };

  const v = variants[plan_status];

  return (
    <div
      className={`rounded-2xl ${v.bg} ring-1 ring-inset ${v.ring} px-5 py-4 flex items-start gap-4 ${className}`}
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
  );
}
