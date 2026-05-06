import type { ReactNode } from "react";

export interface KeyResultListItemProps {
  title: string;
  progress: number;
  indirectProgress?: number;
  status: string;
  targetString: string;
  metricTypeString?: string;
  actions?: ReactNode;
  alertBanner?: ReactNode;
  subtitle?: ReactNode;
}

function getKRStatusStyles(status: string, progress: number) {
  const s = status.toLowerCase();
  if (s === "published" || s === "on_track" || (s === "open" && progress >= 50)) {
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      bar: "bg-emerald-500",
      label: s === "published" ? "Published" : "On Track",
    };
  }
  
  if (s === "at_risk" || (s === "open" && progress < 50 && progress > 0)) {
    return {
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
      bar: "bg-amber-500",
      label: "At Risk",
    };
  }

  if (s === "not_started" || s === "draft" || progress === 0) {
    return {
      text: "text-slate-500",
      bg: "bg-slate-50",
      border: "border-slate-100",
      bar: "bg-slate-300",
      label: s === "draft" ? "Draft" : "Not Started",
    };
  }
  
  return {
    text: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100",
    bar: "bg-sky-500",
    label: status.replace("_", " "),
  };
}

export default function KeyResultListItem({
  title,
  progress,
  indirectProgress = 0,
  status,
  targetString,
  metricTypeString,
  actions,
  alertBanner,
  subtitle
}: KeyResultListItemProps) {
  
  const styles = getKRStatusStyles(status, progress);
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const clampedIndirectProgress = Math.min(100, Math.max(0, indirectProgress));

  return (
    <div className="group relative bg-white p-5 rounded-2xl border border-slate-200 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className={`px-2 py-0.5 rounded-md border font-space text-[10px] font-black uppercase tracking-widest ${styles.bg} ${styles.text} ${styles.border}`}>
               {styles.label}
            </div>
            {metricTypeString && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-space">
                {metricTypeString}
              </span>
            )}
          </div>

          <h4 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors mb-1 leading-snug">
            {title}
          </h4>
          
          {subtitle && (
             <div className="mb-4 text-xs font-medium text-slate-400">
               {subtitle}
             </div>
          )}

          {/* Progress Section */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">Progress</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase">Direct</span>
                  <span className="text-xs font-black text-slate-900 font-space">{clampedProgress}%</span>
                </div>
                <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                  <div 
                     className={`absolute inset-y-0 left-0 transition-all duration-1000 ease-out animate-liquid-progress ${styles.bar}`} 
                     style={{ width: `${clampedProgress}%` }}
                  />
                </div>
              </div>
              {clampedIndirectProgress > 0 && (
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase">Indirect</span>
                    <span className="text-xs font-black text-slate-900 font-space">{clampedIndirectProgress}%</span>
                  </div>
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                    <div 
                       className={`absolute inset-y-0 left-0 transition-all duration-1000 ease-out animate-liquid-progress bg-slate-400`} 
                       style={{ width: `${clampedIndirectProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {alertBanner && (
             <div className="mt-4">
                {alertBanner}
             </div>
          )}
        </div>

        <div className="flex flex-row lg:flex-col justify-between items-center lg:items-end lg:w-56 shrink-0 pt-1">
           <div className="text-left lg:text-right">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space mb-1">Target Metric</div>
              <div className="text-lg font-black text-slate-900 tracking-tight">{targetString}</div>
           </div>
           
           {actions && (
              <div className="flex items-center gap-2 mt-4">
                 {actions}
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
