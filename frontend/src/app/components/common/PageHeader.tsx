import React from "react";

interface PageHeaderProps {
  children?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  children,
  className = "",
}: PageHeaderProps) {
  return (
    <div
      className={`bg-k-orange rounded-2xl p-6 md:p-8 text-white mb-8 relative overflow-hidden shadow-lg ${className}`}
    >
      {/* Decorative background element */}
      <div className="absolute right-0 top-0 h-full w-1/3 opacity-70 pointer-events-none text-k-yellow">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="fill-current">
          <path
            d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,81.6,-46.6C91.4,-34.1,98.1,-19.2,95.8,-5.3C93.5,8.6,82.2,21.5,70.6,32.2C59,42.9,47.1,51.4,34.8,58.6C22.5,65.8,9.8,71.7,-2.3,75.7C-14.4,79.7,-25.9,81.8,-36.6,76.5C-47.3,71.2,-57.2,58.5,-66.2,45.2C-75.2,31.9,-83.3,18,-83.5,3.9C-83.7,-10.2,-76,-24.5,-65.8,-36.2C-55.6,-47.9,-42.9,-57,-29.9,-64.8C-16.9,-72.6,-3.6,-79.1,10.1,-78.5C23.8,-77.9,30.5,-83.6,44.7,-76.4Z"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
