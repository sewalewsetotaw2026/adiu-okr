import {
  MdOutlineCorporateFare,
  MdChevronRight,
  MdCheckCircle,
  MdWarning,
  MdTrendingUp,
} from "react-icons/md";
import {
  formatOkrCount,
  formatOkrNumber,
} from "../../../../../utils/okrNumber";

type DepartmentSummaryCardProps = {
  id: number;
  name: string;
  objectiveCount: number;
  krCount: number;
  progressPercent: number;
  employeeCount: number;
  atRiskCount?: number;
  onNavigate: (id: number) => void;
};

/**
 * Department summary card showing key metrics:
 * - Number of objectives & KRs
 * - Overall progress percentage
 * - Employee count
 * - At-risk KRs indicator
 */
export default function DepartmentSummaryCard({
  id,
  name,
  objectiveCount,
  krCount,
  progressPercent,
  employeeCount,
  atRiskCount = 0,
  onNavigate,
}: DepartmentSummaryCardProps) {
  const progressColor =
    progressPercent >= 75
      ? "text-green-600"
      : progressPercent >= 50
        ? "text-blue-600"
        : progressPercent >= 25
          ? "text-amber-600"
          : "text-red-600";

  const progressBgColor =
    progressPercent >= 75
      ? "bg-green-50"
      : progressPercent >= 50
        ? "bg-blue-50"
        : progressPercent >= 25
          ? "bg-amber-50"
          : "bg-red-50";

  const statusLabel =
    atRiskCount > 0 || progressPercent < 75 ? "Off Track" : "On Track";

  return (
    <button
      type="button"
      onClick={() => onNavigate(id)}
      className="group relative w-full text-left rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/40 border border-slate-100 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/20 hover:bg-slate-50"
    >
      {/* Header: Department name & icon */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-primary/5 group-hover:border-primary/10 transition-all duration-300 shrink-0">
            <MdOutlineCorporateFare className="text-xl text-slate-400 group-hover:text-primary transition-colors" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900 tracking-tight group-hover:text-primary transition-colors truncate font-space capitalize">
              {name}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1 line-clamp-1">
              {formatOkrCount(employeeCount)}{" "}
              {employeeCount === 1 ? "team member" : "team members"}
            </p>
          </div>
        </div>

        {/* Navigate arrow */}
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all duration-500 shrink-0 ml-2">
          <MdChevronRight className="text-base group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Objectives */}
        <div className="bg-slate-50 rounded-lg p-3 text-center group-hover:bg-slate-100 transition-colors">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Objectives
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatOkrCount(objectiveCount)}
          </div>
        </div>

        {/* Key Results */}
        <div className="bg-slate-50 rounded-lg p-3 text-center group-hover:bg-slate-100 transition-colors">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Key Results
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatOkrCount(krCount)}
          </div>
        </div>

        {/* Progress */}
        <div
          className={`${progressBgColor} rounded-lg p-3 text-center group-hover:opacity-80 transition-opacity`}
        >
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
            Progress
          </div>
          <div className={`text-2xl font-black ${progressColor}`}>
            {formatOkrNumber(progressPercent)}%
          </div>
        </div>
      </div>

      {/* Status bar & alerts */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {statusLabel === "On Track" ? (
            <MdCheckCircle className="text-green-600 text-base" />
          ) : atRiskCount > 0 ? (
            <MdWarning className="text-amber-600 text-base" />
          ) : (
            <MdTrendingUp className="text-blue-600 text-base" />
          )}
          <span className="text-xs font-semibold text-slate-600">
            {statusLabel}
          </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-primary font-space">
          View Details
        </span>
      </div>
    </button>
  );
}
