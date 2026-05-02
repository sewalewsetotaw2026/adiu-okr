import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";

type Props = {
  label: string;
  value: string | number;
  progress?: number;
  loading?: boolean;
  prefix?: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
};

export default function MetricStat({ 
  label, 
  value, 
  progress, 
  loading,
  prefix,
  trend 
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <LoadingSkeleton variant="text" width="40%" height={12} />
        <LoadingSkeleton variant="text" width="60%" height={24} />
        {progress !== undefined && <LoadingSkeleton variant="rectangular" width="100%" height={8} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 group">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-space group-hover:text-primary transition-colors">
        {label}
      </span>
      
      <div className="flex items-baseline gap-2">
        {prefix && <span className="text-sm font-medium text-slate-400">{prefix}</span>}
        <span className="text-2xl font-bold text-slate-900 tracking-tight">
          {value}
        </span>
        {trend && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            trend.isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}>
            {trend.isUp ? '↑' : '↓'} {trend.value}%
          </span>
        )}
      </div>

      {progress !== undefined && (
        <div className="w-full bg-slate-100 h-2 rounded-full mt-1.5 overflow-hidden ring-1 ring-slate-50">
          <div
            className="bg-primary h-full rounded-full transition-all duration-1000 ease-out liquid-progress shadow-[0_0_8px_rgba(229,84,0,0.3)]"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
