import { MdBarChart, MdTrendingUp, MdTrendingDown, MdAssessment, MdOutlineHub, MdAutoGraph } from "react-icons/md";
import { AnnualStats } from "./types";

type Props = {
  annualStats: AnnualStats;
};

export default function AnnualSummaryCards({ annualStats }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
      {[
        {
          label: "Avg Score",
          value: annualStats.avgScore != null ? annualStats.avgScore.toFixed(1) : "—",
          sub: `${annualStats.quarters} quarter${annualStats.quarters !== 1 ? "s" : ""}`,
          icon: <MdBarChart size={20} />,
          color: "text-primary bg-primary/10",
          trend: annualStats.trend,
        },
        {
          label: "Avg Completion",
          value: annualStats.avgCompletion != null ? `${annualStats.avgCompletion.toFixed(1)}%` : "—",
          sub: "Across all quarters",
          icon: <MdAssessment size={20} />,
          color: "text-emerald-600 bg-emerald-50",
          trend: null,
        },
        {
          label: "Total Objectives",
          value: String(annualStats.totalObjectives),
          sub: "Aggregated annually",
          icon: <MdOutlineHub size={20} />,
          color: "text-violet-600 bg-violet-50",
          trend: null,
        },
        {
          label: "Total Key Results",
          value: String(annualStats.totalKRs),
          sub: "Across all KRs",
          icon: <MdAutoGraph size={20} />,
          color: "text-sky-600 bg-sky-50",
          trend: null,
        },
      ].map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
        >
          <div className={`inline-flex p-2.5 rounded-xl ${card.color} mb-3`}>
            {card.icon}
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black tracking-tighter text-slate-900">{card.value}</p>
            {card.trend != null && (
              <span className={`flex items-center gap-0.5 text-xs font-bold ${card.trend >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                {card.trend >= 0 ? <MdTrendingUp size={14} /> : <MdTrendingDown size={14} />}
                {Math.abs(card.trend).toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
