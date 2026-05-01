import React from "react";

interface LoadingScreenProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  className = "w-full min-h-[400px] flex items-center justify-center py-20",
}) => {
  return (
    <div className={className}>
      <div className="h-64 w-full shimmer-bg rounded-2xl" />

      {/* Legacy "K" Animation - Retained but inactive for now */}
      {/* 
      <div className="relative flex flex-col items-center justify-center">
        <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 20 L30 80" stroke="#F97316" strokeWidth="16" strokeLinecap="round" />
          <path d="M30 50 L65 20" stroke="#FACC15" strokeWidth="16" strokeLinecap="round" />
          <path d="M30 50 L65 80" stroke="#EA580C" strokeWidth="16" strokeLinecap="round" />
        </svg>
      </div>
      */}
    </div>
  );
};

export default LoadingScreen;
