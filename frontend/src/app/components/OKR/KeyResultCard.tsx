import type { Status } from "../../pages/Admin/OKR/components/StatusBadge";
import StatusBadge from "../../pages/Admin/OKR/components/StatusBadge";
import BulletText from "../common/BulletText";
import { MdTrendingUp, MdTrackChanges, MdGroups, MdBusiness, MdSend, MdModeComment } from "react-icons/md";
import { formatOkrNumber } from "../../utils/okrNumber";

export interface KeyResultData {
  id: number;
  title: string;
  description?: string;
  status: string;
  progress: number;
  weight: number;
  currentValue?: number;
  targetValue?: number;
  unitOfMeasure?: string;
  // For admin/company KRs
  assignedDepartmentIds?: number[];
  // For employee KRs  
  assignedEmployeeIds?: number[];
  // Optional display helpers
  departmentNameById?: Map<number, string>;
  employeeNameById?: Map<number, string>;
  comments?: any[];
}

export interface KeyResultCardProps {
  kr: KeyResultData;
  variant: "admin" | "employee";
  onEdit?: (kr: KeyResultData) => void;
  onDelete?: (kr: KeyResultData) => void;
  onDecompose?: (krId: number) => void;
  showDecompose?: boolean;
  isReadOnly?: boolean;
  index?: number;
}

export default function KeyResultCard({
  kr,
  variant,
  onEdit,
  onDelete,
  onDecompose,
  showDecompose = false,
  isReadOnly = false,
  index,
}: KeyResultCardProps) {
  const isDraft = kr.status !== "published" && kr.status !== "approved";

  return (
    <div className="group relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 hover:border-primary/20 transition-all duration-500 ease-out">
      {/* Left accent bar with gradient */}
      <div className="absolute left-0 top-0 h-full w-2 bg-slate-50 group-hover:bg-gradient-to-b group-hover:from-primary group-hover:to-primary-600 transition-all duration-500" />

      {index !== undefined && (
        <div className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center shadow-lg shadow-primary/20 ring-4 ring-white">
          {index + 1}
        </div>
      )}

      <div className="pl-14 pr-8 py-7">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="min-w-0 flex-1 space-y-3">
            {/* Status & ID Badge Row */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* <div className="flex items-center bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
                  KR #{kr.id}
                </span>
              </div> */}
              <StatusBadge status={kr.status as Status} />

            </div>

            {/* Title - Bold & Premium */}
            <h4 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-primary transition-colors leading-tight">
              {kr.title}
            </h4>

            {/* Description - Better line height */}
            {kr.description && (
              <div className="text-sm text-slate-500 leading-relaxed line-clamp-3 font-medium max-w-2xl">
                <BulletText text={kr.description} />
              </div>
            )}
          </div>

          {/* Action Buttons - Refined Grouping */}
          {!isReadOnly && (
            <div className="flex gap-2 shrink-0 flex-wrap sm:flex-col sm:items-end justify-start">
              {isDraft && onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(kr)}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-slate-50 text-slate-600 text-[10px] font-black tracking-widest font-space border border-slate-100 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all duration-300"
                >
                  Edit
                </button>
              )}
              {isDraft && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(kr)}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-rose-50 text-rose-500 text-[10px] font-black tracking-widest font-space border border-rose-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all duration-300"
                >
                  Delete
                </button>
              )}
              {showDecompose && onDecompose && (
                <button
                  type="button"
                  onClick={() => onDecompose(kr.id)}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-primary text-white text-[10px] font-black tracking-widest font-space border border-primary hover:bg-primary-600 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 gap-2"
                >
                  <MdSend className="text-sm" />
                  Decompose
                </button>
              )}
            </div>
          )}
        </div>

        {/* Metrics Section - Elevated Visuals */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 p-5 rounded-[1.5rem] bg-slate-50/50 border border-slate-100/50">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space flex items-center gap-1.5">
              <MdTrendingUp className="text-primary text-xs" />
              Progress
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 tracking-tighter">{kr.progress}</span>
              <span className="text-sm font-black text-slate-300">%</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space flex items-center gap-1.5">
              <MdTrackChanges className="text-primary text-xs" />
              Weight
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 tracking-tighter">{kr.weight}</span>
              <span className="text-sm font-black text-slate-300">%</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
              Current / Target
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-primary tracking-tighter">
                {formatOkrNumber(kr.currentValue ?? 0)}
              </span>
              <span className="text-lg font-black text-slate-200">/</span>
              <span className="text-lg font-black text-slate-400 tracking-tighter">
                {formatOkrNumber(kr.targetValue ?? 0)}
              </span>
              {kr.unitOfMeasure && (
                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  {kr.unitOfMeasure}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Assignments Row - Cleaner Presentation */}
        {kr.assignedDepartmentIds && kr.assignedDepartmentIds.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-50 flex items-center gap-4">
             <div className="shrink-0 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
              <MdBusiness className="text-base" />
              Departments
            </div>
            <div className="flex flex-wrap gap-2">
              {kr.assignedDepartmentIds
                .filter((id) => kr.departmentNameById?.has(id))
                .map((deptId) => (
                  <span
                    key={deptId}
                    className="px-3 py-1.5 rounded-full bg-primary/5 text-[10px] font-bold text-primary border border-primary/10 hover:bg-primary/10 transition-colors cursor-default"
                  >
                    {kr.departmentNameById?.get(deptId)}
                  </span>
                ))}
            </div>
          </div>
        )}

        {kr.assignedEmployeeIds && kr.assignedEmployeeIds.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-50 flex items-center gap-4">
            <div className="shrink-0 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
              <MdGroups className="text-base" />
              Owners
            </div>
            <div className="flex flex-wrap gap-2">
              {kr.assignedEmployeeIds
                .filter((eid) => kr.employeeNameById?.has(eid))
                .map((eid) => (
                  <div
                    key={eid}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full group/owner hover:border-primary/30 transition-all cursor-default"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <MdGroups className="text-primary text-[10px]" />
                    </div>
                    <span className="text-[10px] font-black text-slate-600 tracking-widest font-space uppercase">
                      {kr.employeeNameById?.get(eid)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Feedback Section */}
        {kr.comments && kr.comments.length > 0 && kr.status === "draft" && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
            <div className="flex items-center gap-2 text-amber-800">
              <MdModeComment className="text-sm" />
              <span className="text-[10px] font-black uppercase tracking-widest font-space">
                Reviewer Feedback
              </span>
            </div>
            <div className="space-y-2">
              {kr.comments.map((c, idx) => (
                <p key={idx} className="text-xs text-amber-900 leading-relaxed italic">
                  "{c.comment}"
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar - Thicker & Dynamic */}
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-50">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-600 shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.3)] transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(100, kr.progress)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
