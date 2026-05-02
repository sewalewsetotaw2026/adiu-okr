import React, { ReactNode } from "react";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import Checkbox from "./Checkbox";

// ==========================================
// Table Column Definition
// ==========================================
export interface TableColumn<T> {
  key: string;
  header: string | ReactNode;
  render?: (item: T, index: number) => ReactNode;
  className?: string; // Cell class
  headerClassName?: string; // Header cell class
  stopPropagation?: boolean;
}

// ==========================================
// Table Skeleton Component
// ==========================================
interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export function TableSkeleton({ columns = 6, rows = 5 }: TableSkeletonProps) {
  // Fixed widths to prevent layout shift
  const widths = [120, 80, 140, 100, 80, 60];

  return (
    <div className="animate-pulse min-w-[800px]">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 p-4 border-b border-gray-200 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 bg-gray-200 rounded shrink-0"
              style={{ width: `${widths[colIndex % widths.length]}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ==========================================
// Empty State Component
// ==========================================
interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title = "No data found",
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {Icon && <Icon className="text-6xl text-gray-300 mx-auto mb-4" />}
      <p className="text-gray-800 font-medium text-lg">{title}</p>
      {description && (
        <p className="text-gray-500 text-sm mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ==========================================
// Pagination Component
// ==========================================
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 10,
  onPageChange,
  itemLabel = "item",
}: PaginationProps & { itemLabel?: string }) {
  const showingCount =
    totalItems === 0
      ? 0
      : Math.min(itemsPerPage, totalItems - (currentPage - 1) * itemsPerPage);

  return (
    <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-b-2xl border-t border-gray-200">
      <span className="text-sm text-gray-600">
        Showing {showingCount}{" "}
        {showingCount === 1 ? itemLabel : `${itemLabel}s`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage <= 1 || !onPageChange}
          className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Previous page"
        >
          <MdChevronLeft className="text-xl text-gray-600" />
        </button>
        <button
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage >= totalPages || !onPageChange}
          className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Next page"
        >
          <MdChevronRight className="text-xl text-gray-600" />
        </button>
      </div>
    </div>
  );
}

// ==========================================
// Data Table Component
// ==========================================
interface DataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  emptyState?: EmptyStateProps;
  keyExtractor: (item: T, index: number) => string | number;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T, index: number) => string;
  pagination?: PaginationProps;
  skeletonColumns?: number;
  skeletonRows?: number;
  className?: string; // Container class
  tableClassName?: string; // Table element class
  itemLabel?: string;
  enableSelection?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onSelectAll?: (isSelectAll: boolean) => void; // Optional custom select all handler
}

export default function DataTable<T>({
  data,
  columns,
  loading = false,
  emptyState,
  keyExtractor,
  onRowClick,
  rowClassName,
  pagination,
  skeletonColumns,
  skeletonRows,
  className = "",
  tableClassName = "",
  itemLabel = "item",
  enableSelection = false,
  selectedIds = [],
  onSelectionChange,
  onSelectAll,
}: DataTableProps<T>) {
  const safeData = Array.isArray(data) ? data : [];

  // Internal Logic for Selection
  const isAllSelected =
    safeData.length > 0 &&
    safeData.every((item, idx) => selectedIds.includes(String(keyExtractor(item, idx))));

  const handleToggleRow = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleToggleAll = () => {
    if (onSelectAll) {
      onSelectAll(!isAllSelected);
      return;
    }
    if (!onSelectionChange) return;

    if (isAllSelected) {
      // Unselect all in current view
      const currentIds = safeData.map((item, idx) => String(keyExtractor(item, idx)));
      onSelectionChange(selectedIds.filter((id) => !currentIds.includes(id)));
    } else {
      // Select all in current view
      const currentIds = safeData.map((item, idx) => String(keyExtractor(item, idx)));
      // Merge unique
      const newIds = Array.from(new Set([...selectedIds, ...currentIds]));
      onSelectionChange(newIds);
    }
  };

  // Prepend Selection Column if enabled
  const displayColumns = enableSelection
    ? [
      {
        key: "_selection",
        header: (
          <div className="flex justify-center">
            <Checkbox
              checked={isAllSelected}
              onChange={handleToggleAll}
              className="!w-4 !h-4 accent-primary border-gray-300"
            />
          </div>
        ),
        headerClassName: "w-[50px] text-center",
        className: "w-[50px] text-center",
        stopPropagation: true,
        render: (item: T, index: number) => {
          const id = String(keyExtractor(item, index));
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={selectedIds.includes(id)}
                onChange={() => handleToggleRow(id)}
                className="!w-4 !h-4 accent-primary"
              />
            </div>
          );
        },
      },
      ...columns,
    ]
    : columns;

  return (
    <div className={`bg-white rounded-2xl shadow-card flex flex-col ${className}`}>
      <div className="overflow-x-auto flex-1">
        {loading ? (
          <TableSkeleton
            columns={skeletonColumns || columns.length + (enableSelection ? 1 : 0)}
            rows={skeletonRows || 5}
          />
        ) : safeData.length === 0 ? (
          <EmptyState {...emptyState} />
        ) : (
          <table
            className={`w-full text-left border-collapse min-w-[800px] ${tableClassName}`}
          >
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm font-semibold">
                {displayColumns.map((col, index) => (
                  <th
                    key={col.key}
                    className={`p-4 border border-gray-200 ${index === 0 && !enableSelection ? "rounded-tl-lg" : ""
                      } ${index === displayColumns.length - 1 ? "rounded-tr-lg" : ""} ${col.headerClassName || ""
                      } ${col.key === "actions"
                        ? "sticky right-0 z-10 bg-gray-50 shadow-[-5px_0px_10px_-5px_rgba(0,0,0,0.1)] border-l"
                        : ""
                      }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm text-gray-700">
              {safeData.map((item, index) => {
                const id = String(keyExtractor(item, index));
                const isSelected = selectedIds.includes(id);
                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(item)}
                    className={`group border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors ${onRowClick ? "cursor-pointer" : ""
                      } ${isSelected ? "bg-primary-50/50" : ""} ${rowClassName?.(item, index) || ""
                      }`}
                  >
                    {displayColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`p-4 border border-gray-200 ${col.className || ""} ${col.key === "actions"
                          ? `sticky right-0 z-10 border-l shadow-[-5px_0px_10px_-5px_rgba(0,0,0,0.1)] ${isSelected ? "bg-primary-light" : "bg-white group-hover:bg-gray-50"
                          }`
                          : ""
                          }`}
                        onClick={(e) => {
                          if (col.stopPropagation) {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {col.render
                          ? col.render(item, index)
                          : (item as Record<string, unknown>)[col.key] !==
                            undefined
                            ? String((item as Record<string, unknown>)[col.key])
                            : "-"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {/* Always show pagination info when we have data or explicit pagination */}
      {
        (pagination || safeData.length > 0) && (
          <Pagination
            currentPage={pagination?.currentPage || 1}
            totalPages={pagination?.totalPages || 1}
            totalItems={pagination?.totalItems ?? safeData.length}
            itemsPerPage={pagination?.itemsPerPage || safeData.length || 10}
            onPageChange={pagination?.onPageChange}
            itemLabel={itemLabel}
          />
        )
      }
    </div >
  );
}
