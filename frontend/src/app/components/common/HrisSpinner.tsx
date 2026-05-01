import React from "react";

interface HrisSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  variant?: "inline" | "screen";
  showText?: boolean;
  text?: string;
}

export const HRIS_SPINNER_CYCLE_MS = 1200;

const HrisSpinner: React.FC<HrisSpinnerProps> = ({
  size = "md",
  className = "",
  variant = "inline",
  showText,
  text = "",
}) => {
  const sizeMap = {
    sm: 20,
    md: 28,
    lg: 40,
    xl: 52,
  };

  const svgSize = sizeMap[size];

  const resolvedShowText =
    typeof showText === "boolean"
      ? showText
      : variant === "screen" && size !== "sm";

  return (
    <div
      className={`inline-flex flex-col items-center justify-center ${className}`}
    >
      <style>{`
        /* 
         * Draw-Erase-Redraw Animation Cycle
         * One full cycle: Draw all 3 strokes sequentially → Erase all 3 strokes sequentially
         * Timeline (100% = full cycle):
         *   0-10%:   Draw vertical line
         *   10-20%:  Draw top slash  
         *   20-30%:  Draw bottom slash
         *   30-50%:  Hold complete K
         *   50-60%:  Erase vertical line
         *   60-70%:  Erase top slash
         *   70-80%:  Erase bottom slash
         *   80-100%: Pause before restart
         */
        
        @keyframes hris-draw-erase-v-line {
          0% {
            stroke-dashoffset: 100;
          }
          10%, 50% {
            stroke-dashoffset: 0;
          }
          60%, 100% {
            stroke-dashoffset: 100;
          }
        }

        @keyframes hris-draw-erase-top-slash {
          0%, 10% {
            stroke-dashoffset: 100;
          }
          20%, 50% {
            stroke-dashoffset: 0;
          }
          70%, 100% {
            stroke-dashoffset: 100;
          }
        }

        @keyframes hris-draw-erase-bot-slash {
          0%, 20% {
            stroke-dashoffset: 100;
          }
          30%, 50% {
            stroke-dashoffset: 0;
          }
          80%, 100% {
            stroke-dashoffset: 100;
          }
        }

        @keyframes hris-k-breathe {
          0%, 100% { transform: scale(1); }
          40% { transform: scale(1.03); }
        }

        .hris-k-wrapper {
          animation: hris-k-breathe ${HRIS_SPINNER_CYCLE_MS}ms ease-in-out infinite;
          will-change: transform;
        }

        .hris-stroke {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          will-change: stroke-dashoffset;
        }

        .hris-v-line { 
          animation: hris-draw-erase-v-line ${HRIS_SPINNER_CYCLE_MS}ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
          filter: drop-shadow(0 0 3px rgba(229, 84, 0, 0.35)); 
        }
        
        .hris-top-slash { 
          animation: hris-draw-erase-top-slash ${HRIS_SPINNER_CYCLE_MS}ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
          filter: drop-shadow(0 0 3px rgba(255, 218, 0, 0.45)); 
        }
        
        .hris-bot-slash { 
          animation: hris-draw-erase-bot-slash ${HRIS_SPINNER_CYCLE_MS}ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
          filter: drop-shadow(0 0 3px rgba(229, 84, 0, 0.28)); 
        }
      `}</style>

      <div className="hris-k-wrapper">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          className="hris-k-svg-container"
        >
          {/* Vertical line (left side of K) - Orange */}
          <path
            d="M30 20 L30 80"
            stroke="var(--color-primary)"
            strokeWidth="16"
            strokeLinecap="round"
            fill="none"
            pathLength={100}
            className="hris-stroke hris-v-line"
          />

          {/* Top diagonal slash (upper part of K) - Yellow */}
          <path
            d="M30 50 L65 20"
            stroke="var(--color-secondary)"
            strokeWidth="16"
            strokeLinecap="round"
            fill="none"
            pathLength={100}
            className="hris-stroke hris-top-slash"
          />

          {/* Bottom diagonal slash (lower part of K) - Orange */}
          <path
            d="M30 50 L65 80"
            stroke="#e55400"
            strokeWidth="16"
            strokeLinecap="round"
            fill="none"
            pathLength={100}
            className="hris-stroke hris-bot-slash"
          />
        </svg>
      </div>

      {resolvedShowText && (
        <div className="mt-3 text-center">
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.4em] animate-pulse">
            {text}
          </p>
        </div>
      )}
    </div>
  );
};

export default HrisSpinner;
