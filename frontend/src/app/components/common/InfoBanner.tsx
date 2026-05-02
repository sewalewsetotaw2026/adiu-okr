import { ReactNode } from "react";

type BannerVariant = "info" | "success" | "warning" | "error";

interface InfoBannerProps {
  children: ReactNode;
  variant?: BannerVariant;
  className?: string;
}

const variantStyles: Record<BannerVariant, string> = {
  info: "bg-blue-50 border-blue-100 text-blue-800",
  success: "bg-green-50 border-green-100 text-green-800",
  warning: "bg-yellow-50 border-yellow-100 text-yellow-800",
  error: "bg-red-50 border-red-100 text-red-800",
};

export default function InfoBanner({
  children,
  variant = "info",
  className = "",
}: InfoBannerProps) {
  return (
    <div
      className={`rounded-xl p-4 border ${variantStyles[variant]} ${className}`}
    >
      <div className="text-sm">{children}</div>
    </div>
  );
}
