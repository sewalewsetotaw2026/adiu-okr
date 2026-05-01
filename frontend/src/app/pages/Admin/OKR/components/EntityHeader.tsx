type Props = {
  title: string;
  subtitle?: string;
  status?: "draft" | "published" | "closed" | "open" | "planning";
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "card" | "header";
};

import StatusBadge from "./StatusBadge";
import BulletText from "../../../../components/common/BulletText";

export default function EntityHeader({
  title,
  subtitle,
  status,
  actions,
  icon,
  variant = "card",
}: Props) {
  const isHeader = variant === "header";

  return (
    <div
      className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isHeader ? "" : "bg-white rounded-2xl p-6 shadow-sm"
      }`}
    >
      <div>
        <div className="flex items-center gap-3">
          {icon && (
            <span
              className={`text-xl ${isHeader ? "text-white" : "text-gray-700"}`}
            >
              {icon}
            </span>
          )}

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h1
              className={`text-xl font-bold truncate min-w-0 ${
                isHeader ? "text-white" : "text-gray-900"
              }`}
              title={title}
            >
              {title}
            </h1>
            {status ? <StatusBadge status={status} /> : null}
          </div>
        </div>

        {subtitle && (
          <BulletText
            text={subtitle}
            className={`text-sm mt-1 ${
              isHeader ? "text-white/80" : "text-gray-500"
            }`}
          />
        )}
      </div>

      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
