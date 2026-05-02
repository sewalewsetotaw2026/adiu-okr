import type { ReactNode } from "react";

export type OkrStatusTone =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "primary"
  | "neutral"
  | "muted";

export type OkrStatusSize = "xs" | "sm" | "md";

type Props = {
  tone?: OkrStatusTone;
  size?: OkrStatusSize;
  icon?: ReactNode;
  pulse?: boolean;
  className?: string;
  children?: ReactNode;
  label?: ReactNode;
};

const toneClasses: Record<OkrStatusTone, string> = {
  success:
    "bg-success/10 text-success ring-1 ring-inset ring-success/20",
  warning:
    "bg-warning/15 text-k-dark-grey ring-1 ring-inset ring-warning/30",
  error:
    "bg-error/10 text-error ring-1 ring-inset ring-error/20",
  info: "bg-info/10 text-info ring-1 ring-inset ring-info/20",
  primary:
    "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20",
  neutral:
    "bg-k-light-grey text-k-dark-grey ring-1 ring-inset ring-gray-200",
  muted:
    "bg-gray-50 text-k-medium-grey ring-1 ring-inset ring-gray-200",
};

const toneDotClasses: Record<OkrStatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
  primary: "bg-primary",
  neutral: "bg-k-medium-grey",
  muted: "bg-k-medium-grey",
};

const sizeClasses: Record<OkrStatusSize, string> = {
  xs: "px-2 py-0.5 text-[11px] gap-1",
  sm: "px-2.5 py-0.5 text-xs gap-1.5",
  md: "px-3 py-1 text-sm gap-1.5",
};

const dotSizeClasses: Record<OkrStatusSize, string> = {
  xs: "h-1.5 w-1.5",
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
};

export default function OkrStatusBadge({
  tone = "neutral",
  size = "sm",
  icon,
  pulse = false,
  className = "",
  children,
  label,
}: Props) {
  const content = label || children;
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${sizeClasses[size]} ${toneClasses[tone]} ${className}`}
    >
      {icon ? (
        <span className="inline-flex items-center">{icon}</span>
      ) : (
        <span
          className={`relative inline-block rounded-full ${dotSizeClasses[size]} ${toneDotClasses[tone]}`}
        >
          {pulse ? (
            <span
              className={`absolute inset-0 rounded-full ${toneDotClasses[tone]} opacity-60 animate-ping`}
            />
          ) : null}
        </span>
      )}
      {content && <span>{content}</span>}
    </span>
  );
}
