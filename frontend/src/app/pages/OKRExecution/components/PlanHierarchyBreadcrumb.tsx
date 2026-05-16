import React from "react";
import { FiChevronRight } from "react-icons/fi";

interface HierarchyItem {
  title: string;
  subtitle?: string;
  type: "objective" | "kr" | "monthly" | "weekly" | "daily";
  status?: string;
}

interface PlanHierarchyBreadcrumbProps {
  items: HierarchyItem[];
  className?: string;
  maxItems?: number;
}

const typeLabels: Record<HierarchyItem["type"], string> = {
  objective: "Objective",
  kr: "Key Result",
  monthly: "Monthly",
  weekly: "Weekly",
  daily: "Daily",
};

const typeColors: Record<HierarchyItem["type"], string> = {
  objective: "bg-emerald-100 text-emerald-700",
  kr: "bg-blue-100 text-blue-700",
  monthly: "bg-purple-100 text-purple-700",
  weekly: "bg-amber-100 text-amber-700",
  daily: "bg-rose-100 text-rose-700",
};

/**
 * PlanHierarchyBreadcrumb displays the full plan hierarchy from Objective down to the current plan level.
 * Shows type badges and titles for each level in the chain.
 */
export default function PlanHierarchyBreadcrumb({
  items,
  className = "",
  maxItems = 5,
}: PlanHierarchyBreadcrumbProps) {
  if (!items || items.length === 0) return null;

  // Truncate if too many items (keep first and last, show ellipsis in middle)
  const displayItems =
    items.length > maxItems
      ? [items[0], { type: items[1].type, title: "...", subtitle: "" }, items[items.length - 1]]
      : items;

  return (
    <div
      className={`flex flex-wrap items-center gap-1 text-xs ${className}`}
      aria-label="Plan hierarchy"
    >
      {displayItems.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <FiChevronRight
              className="text-slate-300 mx-0.5 flex-shrink-0"
              size={14}
            />
          )}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${
              item.title === "..."
                ? "text-slate-400"
                : "bg-slate-50 ring-1 ring-inset ring-slate-100"
            }`}
            title={item.subtitle || item.title}
          >
            {item.title !== "..." && (
              <span
                className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  typeColors[item.type]
                }`}
              >
                {typeLabels[item.type]}
              </span>
            )}
            <span
              className={`font-medium truncate max-w-[120px] ${
                item.title === "..." ? "text-slate-400" : "text-slate-700"
              }`}
            >
              {item.title}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Compact version for cards - shows only the direct parent relationship
 */
export function PlanParentInfo({
  parentType,
  parentTitle,
  grandparentTitle,
  className = "",
}: {
  parentType: "kr" | "monthly" | "weekly";
  parentTitle?: string;
  grandparentTitle?: string;
  className?: string;
}) {
  const labels: Record<typeof parentType, string> = {
    kr: "Key Result",
    monthly: "Monthly Plan",
    weekly: "Weekly Plan",
  };

  return (
    <div className={`text-[10px] leading-tight ${className}`}>
      {grandparentTitle && (
        <div className="text-slate-400 mb-0.5 truncate max-w-[200px]">
          {grandparentTitle}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="font-black uppercase tracking-wider text-[9px] text-slate-500">
          {labels[parentType]}
        </span>
        <span className="text-slate-600 truncate max-w-[180px]">
          {parentTitle || "—"}
        </span>
      </div>
    </div>
  );
}
