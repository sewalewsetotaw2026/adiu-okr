import { MdCheckCircle, MdChevronRight, MdRadioButtonUnchecked } from "react-icons/md";
import { Archive } from "./types";
import { formatDate, getCompletion, getScore } from "./utils";
import ScoreBar from "./ScoreBar";

type Props = {
  year: number;
  archives: Archive[];
  selectedArchiveIds: Set<string | number>;
  onToggle: (id: string | number) => void;
  onSelectAllToggle: () => void;
  onOpenDetail: (id: string | number) => void;
};

export default function QuarterBreakdown({
  year,
  archives,
  selectedArchiveIds,
  onToggle,
  onSelectAllToggle,
  onOpenDetail,
}: Props) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Quarter Breakdown</h2>
          <p className="text-xs text-slate-400 mt-0.5">Performance across each archived quarter of {year}</p>
        </div>
        <button
          onClick={onSelectAllToggle}
          className="text-xs font-bold text-primary hover:underline"
        >
          {selectedArchiveIds.size === archives.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      <div className="divide-y divide-slate-50">
        {archives.map((archive) => {
          const score = getScore(archive);
          const completion = getCompletion(archive);
          const label = archive.quarter_name ?? archive.cycle?.quarter_label ?? archive.cycle?.name ?? `Archive #${archive.id}`;
          const date = archive.archived_at ?? archive.cycle?.start_date;
          const isSelected = selectedArchiveIds.has(archive.id);

          return (
            <div
              key={archive.id}
              onClick={() => onOpenDetail(archive.id)}
              className={`flex items-center gap-4 px-6 py-4 transition-all cursor-pointer border-l-4 ${
                isSelected ? "bg-primary/5 border-primary shadow-sm" : "border-transparent hover:bg-slate-50 hover:border-slate-200 hover:shadow-md active:scale-[0.99]"
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(archive.id);
                }}
                className="shrink-0 p-0.5 rounded-md transition-colors hover:bg-primary/10"
                title="Select for export"
              >
                {isSelected ? (
                  <MdCheckCircle size={22} className="text-primary" />
                ) : (
                  <MdRadioButtonUnchecked size={22} className="text-slate-300" />
                )}
              </button>

              <div className="flex-1 min-w-0 text-left group">
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{label}</p>
                  <span className="text-[10px] font-bold text-slate-400">{formatDate(date)}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  {score != null && (
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Score</span>
                      <ScoreBar value={score} />
                    </div>
                  )}
                  {completion != null && (
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Completion</span>
                      <ScoreBar value={completion} />
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden md:flex items-center gap-3 shrink-0 text-xs text-slate-500">
                <span className="bg-slate-100 px-2 py-1 rounded-lg font-bold">
                  {archive.total_objectives ?? "—"} Obj
                </span>
                <span className="bg-slate-100 px-2 py-1 rounded-lg font-bold">
                  {archive.total_key_results ?? "—"} KR
                </span>
              </div>

              <div className="shrink-0 p-2 text-slate-300 group-hover:text-primary transition-all">
                <MdChevronRight size={18} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
