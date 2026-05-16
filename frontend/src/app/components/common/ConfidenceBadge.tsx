import type { ConfidenceLevel } from "../../constants/themeConstants";
import { CONFIDENCE_COLORS } from "../../constants/themeConstants";

export interface ConfidenceBadgeProps {
  /** The confidence level to display. Pass `null` to hide the badge. */
  level: ConfidenceLevel;
  /** Visual size of the badge. Defaults to "sm". */
  size?: "xs" | "sm" | "md";
  /** Whether to show the colored dot before the label. Defaults to true. */
  showDot?: boolean;
  /** Optional extra Tailwind classes for the badge wrapper. */
  className?: string;
}

const SIZE_CLASSES = {
  xs: "text-[9px] px-1.5 py-0.5 gap-1",
  sm: "text-[10px] px-2 py-0.5 gap-1.5",
  md: "text-xs px-2.5 py-1 gap-1.5",
};

const DOT_SIZE_CLASSES = {
  xs: "h-1 w-1",
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
};

/**
 * Reusable confidence level badge for all OKR plan entities.
 *
 * Uses the centralized `CONFIDENCE_COLORS` design tokens so every badge
 * across Quarterly / Monthly / Weekly / Daily plans stays consistent.
 *
 * Color semantics:
 *  🟢 ON_TRACK  — emerald
 *  🟡 AT_RISK   — amber
 *  🔴 OFF_TRACK — rose
 */
export default function ConfidenceBadge({
  level,
  size = "sm",
  showDot = true,
  className = "",
}: ConfidenceBadgeProps) {
  if (!level) return null;

  const colors = CONFIDENCE_COLORS[level];

  return (
    <span
      className={[
        "inline-flex items-center rounded-full font-bold uppercase tracking-widest border",
        colors.bg,
        colors.text,
        colors.border,
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
      title={`Confidence: ${colors.label}`}
      aria-label={`Confidence level: ${colors.label}`}
    >
      {showDot && (
        <span
          className={[
            "rounded-full shrink-0",
            colors.dot,
            DOT_SIZE_CLASSES[size],
          ].join(" ")}
          aria-hidden="true"
        />
      )}
      {colors.label}
    </span>
  );
}
