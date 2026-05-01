import React from "react";

interface Column<T> {
  header: React.ReactNode;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
  headerClassName?: string;
  stopRowClick?: boolean;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  containerClassName?: string;
}

function Table<T>({
  data,
  columns,
  keyExtractor,
  isLoading,
  emptyMessage = "No data found",
  onRowClick,
  rowClassName,
  containerClassName = "",
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-gray-500">Loading data...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={`w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${containerClassName}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columns.map((col, index) => (
                <th
                  key={index}
                  className={`px-6 py-4 text-sm font-semibold text-gray-600 ${
                    index !== columns.length - 1
                      ? "border-r border-gray-200"
                      : ""
                  } ${col.headerClassName || ""} ${col.className || ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((item, rowIndex) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick && onRowClick(item)}
                className={`group hover:bg-yellow-50/50 transition-colors ${
                  onRowClick ? "cursor-pointer" : ""
                } ${rowClassName ? rowClassName(item) : ""}`}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    onClick={
                      col.stopRowClick
                        ? (e) => {
                            e.stopPropagation();
                          }
                        : undefined
                    }
                    className={`px-6 py-4 text-sm text-gray-700 ${
                      colIndex !== columns.length - 1
                        ? "border-r border-gray-100"
                        : ""
                    } ${col.className || ""}`}
                  >
                    {typeof col.accessor === "function"
                      ? col.accessor(item)
                      : (item[col.accessor] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
