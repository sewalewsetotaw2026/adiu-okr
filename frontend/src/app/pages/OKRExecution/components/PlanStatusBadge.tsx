import type { PlanStatus } from "../../../../types/okr.types";

/**
 * Global plan-status badge.
 *
 * Color mapping (per Packet 2 spec):
 *   DRAFT         → grey
 *   SUBMITTED     → blue
 *   UNDER_REVIEW  → amber
 *   APPROVED      → teal
 *   PUBLISHED     → green
 *   REJECTED      → red
 */
type Tone = {
  bg: string;
  text: string;
  ring: string;
  dot: string;
  label: string;
};

const TONES: Record<PlanStatus, Tone> = {
  DRAFT: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    ring: "ring-slate-200",
    dot: "bg-slate-400",
    label: "Draft",
  },
  SUBMITTED: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    ring: "ring-blue-200",
    dot: "bg-blue-500",
    label: "Submitted",
  },
  UNDER_REVIEW: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
    dot: "bg-amber-500",
    label: "Under Review",
  },
  APPROVED: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    ring: "ring-teal-200",
    dot: "bg-teal-500",
    label: "Approved",
  },
  PUBLISHED: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    dot: "bg-emerald-500",
    label: "Published",
  },
  REJECTED: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    ring: "ring-rose-200",
    dot: "bg-rose-500",
    label: "Rejected",
  },
};

export default function PlanStatusBadge({
  status,
  size = "sm",
  className = "",
}: {
  status: PlanStatus;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const tone = TONES[status] ?? TONES.DRAFT;
  const sizeCls =
    size === "xs"
      ? "text-[10px] px-2 py-0.5"
      : size === "md"
        ? "text-sm px-3 py-1"
        : "text-xs px-2.5 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring} ${sizeCls} ${className}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}
