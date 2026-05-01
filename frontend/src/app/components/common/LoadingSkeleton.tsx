// React import removed to fix lint as it's not explicitly used in this snippet

interface LoadingSkeletonProps {
  variant?: "text" | "circular" | "rectangular" | "card" | "table-row";
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

export default function LoadingSkeleton({
  variant = "text",
  width,
  height,
  className = "",
  count = 1,
}: LoadingSkeletonProps) {
  const skeletons = Array.from({ length: count });

  const getClasses = () => {
    const baseClasses = "shimmer-bg rounded";

    switch (variant) {
      case "circular":
        return `${baseClasses} rounded-full`;
      case "rectangular":
        return `${baseClasses} rounded-lg`;
      case "card":
        return "bg-white p-6 rounded-2xl shadow-card border border-gray-100";
      case "table-row":
        return "flex items-center gap-4 py-4 border-b border-gray-50";
      default:
        return `${baseClasses} rounded-md h-4`;
    }
  };

  const renderSkeleton = (index: number) => {
    if (variant === "card") {
      return (
        <div key={index} className={`${getClasses()} ${className}`}>
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 shimmer-bg rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 shimmer-bg rounded w-3/4" />
              <div className="h-3 shimmer-bg rounded w-1/2" />
            </div>
          </div>
          <div className="h-8 shimmer-bg rounded w-full" />
        </div>
      );
    }

    if (variant === "table-row") {
      return (
        <div key={index} className={`${getClasses()} ${className}`}>
          <div className="w-10 h-10 shimmer-bg rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 shimmer-bg rounded w-1/3" />
            <div className="h-3 shimmer-bg rounded w-1/4" />
          </div>
          <div className="w-24 h-6 shimmer-bg rounded" />
        </div>
      )
    }

    return (
      <div
        key={index}
        className={`${getClasses()} ${className}`}
        style={{
          width: width,
          height: height,
        }}
      />
    );
  };

  return <>{skeletons.map((_, i) => renderSkeleton(i))}</>;
}
