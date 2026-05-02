import React from "react";

interface ShimmerProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

export const Shimmer: React.FC<ShimmerProps> = ({
  width = "100%",
  height = "20px",
  className = "",
  rounded = "md",
}) => {
  const roundedMap = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  };

  return (
    <div
      className={`shimmer-bg ${roundedMap[rounded]} ${className}`}
      style={{
        width,
        height,
      }}
    />
  );
};
