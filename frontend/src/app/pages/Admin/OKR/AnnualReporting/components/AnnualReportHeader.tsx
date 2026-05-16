import { MdCalendarToday, MdRefresh } from "react-icons/md";
import PageHeader from "../../../../../components/common/PageHeader";

type Props = {
  selectedYear: number;
  availableYears: number[];
  onSelectYear: (year: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

export default function AnnualReportHeader({
  selectedYear,
  availableYears,
  onSelectYear,
  onRefresh,
  refreshing,
}: Props) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      <PageHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
              <MdCalendarToday size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white">
                Annual OKR Report
              </h1>
              <p className="text-white/80 text-sm font-medium mt-1">
                Company-wide OKR performance aggregated across all quarters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/20">
              <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => onSelectYear(Number(e.target.value))}
                className="bg-transparent border-none text-white text-sm font-bold outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y} className="text-slate-900">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 text-xs font-black uppercase tracking-widest text-white transition-all disabled:opacity-50 shadow-sm"
            >
              <MdRefresh
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
      </PageHeader>
    </div>
  );
}
