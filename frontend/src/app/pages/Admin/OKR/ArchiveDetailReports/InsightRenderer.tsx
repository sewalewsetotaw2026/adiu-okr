import React, { useState } from "react";
import { 
  MdError, 
  MdWarning, 
  MdLink, 
  MdSchedule, 
  MdPerson,
  MdExpandMore,
  MdExpandLess,
  MdSort,
  MdAttachMoney,
  MdWorkspacePremium,
  MdOutlineFlagCircle,
  MdCheckCircleOutline,
  MdGroups,
  MdCorporateFare,
  MdTrendingDown,
  MdAssignmentTurnedIn
} from "react-icons/md";

interface InsightRendererProps {
  type: string;
  payload: any;
}

const InsightRenderer: React.FC<InsightRendererProps> = ({ type, payload }) => {
  const [sortBy, setSortBy] = useState<"score" | "value">("score");
  const [filterType, setFilterType] = useState<"all" | "financial" | "non-financial">("all");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedObj, setExpandedObj] = useState<number | null>(null);

  if (!payload) return <p className="text-sm text-slate-400 italic">No data available for this insight.</p>;

  // Helper to format currency/value
  const formatValue = (val: number | string | null | undefined) => {
    if (val == null) return "—";
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(val));
  };

  // Helper to format score
  const formatScore = (score: number | string | null | undefined) => {
    if (score == null) return "—";
    return `${Number(score).toFixed(1)}%`;
  };

  const renderTopPerformers = () => {
    const rawList = payload.performers || payload.topPerformers || [];
    if (rawList.length === 0) return <p className="text-sm text-slate-500">No performers found.</p>;

    const aggregationLevel = payload.aggregation_level || "individual";
    const isDeptLevel = aggregationLevel === "department";
    const isTeamLevel = aggregationLevel === "team";

    // Helper to get consistent properties
    const getP = (p: any) => ({
      id: p.id || p.user_id || p.team_id || p.dept_id || p.title,
      name: p.name || p.title || p.displayName || "Unknown",
      jobTitle: p.jobTitle || p.role || (isDeptLevel ? "Department" : isTeamLevel ? "Team" : ""),
      department: p.department || p.deptName || "",
      avgScore: p.avgScore ?? p.final_score ?? 0,
      totalValue: p.totalValue ?? p.final_value ?? 0,
      avatar: p.avatar || p.profileImage,
      hasFinancial: p.hasFinancial ?? (Number(p.totalValue || p.final_value || 0) > 0),
      objectives: p.objectives || []
    });

    // Filter and Sort
    const filteredList = rawList
      .map(getP)
      .filter((p: any) => {
        if (filterType === "financial") return p.hasFinancial;
        if (filterType === "non-financial") return !p.hasFinancial;
        return true;
      })
      .sort((a: any, b: any) => {
        if (sortBy === "value") return (Number(b.totalValue) || 0) - (Number(a.totalValue) || 0);
        return (Number(b.avgScore) || 0) - (Number(a.avgScore) || 0);
      });

    const top3 = filteredList.slice(0, 3);

    const PerformerAvatar = ({ avatar, name, rank, entityType }: { avatar?: string, name: string, rank?: number, entityType?: string }) => {
      const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
      const isTeam = entityType?.includes("team");
      const isDept = entityType?.includes("department");

      return (
        <div className="relative w-full h-full">
          <div className={`w-full h-full rounded-full overflow-hidden border-2 border-white shadow-sm flex items-center justify-center ${!avatar ? 'bg-gradient-to-br from-slate-50 to-slate-200' : 'bg-white'}`}>
            {avatar ? (
              <img src={avatar} alt={name} className="w-full h-full object-cover" />
            ) : (
              rank === 1 ? <MdWorkspacePremium className="text-amber-500 text-3xl animate-pulse" /> :
              isTeam ? <MdGroups className="text-indigo-500/40 text-3xl" /> :
              isDept ? <MdCorporateFare className="text-violet-500/40 text-3xl" /> :
              <span className="text-slate-500 font-black text-xs tracking-tighter">{initials}</span>
            )}
          </div>
          {typeof rank === 'number' && rank <= 3 && (
            <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-md transition-transform hover:scale-110 ${
              rank === 1 ? "bg-amber-500" : rank === 2 ? "bg-slate-400" : "bg-[#CD7F32]"
            }`}>
              {rank}
            </div>
          )}
        </div>
      );
    };

    const renderDetails = (item: any) => (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <MdOutlineFlagCircle className="text-primary" size={16} /> Objectives & Key Results
          </h5>
          <span className="text-[10px] font-black text-slate-400">{item.objectives?.length || 0} Items</span>
        </div>
        <div className="divide-y divide-slate-50">
          {item.objectives?.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 italic text-center">No objectives found for this performer.</p>
          ) : (
            item.objectives?.map((obj: any) => {
              const objId = obj.id || obj.title;
              const isObjExpanded = expandedObj === objId;
              return (
                <div key={objId} className="p-4">
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedObj(isObjExpanded ? null : objId);
                    }}
                    className="flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/50 p-2 rounded-xl transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-slate-900 text-sm">{obj.title}</p>
                        {(obj.isFinancial || obj.hasFinancial) && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-amber-600 text-[8px] font-black uppercase tracking-widest">
                            Financial
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, obj.score || obj.final_score || 0)}%` }} />
                          </div>
                          <span className="text-[10px] font-black text-emerald-600">{formatScore(obj.score || obj.final_score)}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">Value: {formatValue(obj.value || obj.final_value)}</span>
                      </div>
                    </div>
                    <div className="text-xs font-black text-primary flex items-center gap-1 shrink-0">
                      {isObjExpanded ? "Hide KRs" : `${obj.krs?.length || 0} KRs`}
                      {isObjExpanded ? <MdExpandLess size={14} /> : <MdExpandMore size={14} />}
                    </div>
                  </div>
                  {isObjExpanded && (
                    <div className="mt-4 ml-4 space-y-3 pl-4 border-l-2 border-slate-100">
                      {obj.krs?.map((kr: any) => (
                        <div key={kr.id || kr.title} className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 mb-0.5">{kr.title}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{kr.metric}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-[10px] font-black text-emerald-600 leading-none">{formatScore(kr.score || kr.final_score)}</p>
                              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">{formatValue(kr.value || kr.final_value)}</p>
                            </div>
                            <MdCheckCircleOutline className="text-emerald-500" size={16} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category Filter</p>
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                {(["all", "financial", "non-financial"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      filterType === t ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {t.replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rank By</p>
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                {(["score", "value"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      sortBy === s ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dataset</p>
            <p className="text-xs font-bold text-slate-700">{filteredList.length} {isDeptLevel ? "Departments" : isTeamLevel ? "Teams" : "Employees"}</p>
          </div>
        </div>

        {/* Podium / Top 3 Hero */}
        {top3.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {top3.map((performer: any, i: number) => {
              const rank = i + 1;
              const isExpanded = expandedUser === performer.id;
              const bgClass = 
                rank === 1 ? "bg-gradient-to-br from-amber-50 to-white border-amber-100 shadow-amber-100/50" :
                rank === 2 ? "bg-gradient-to-br from-slate-50 to-white border-slate-200 shadow-slate-100/30" :
                rank === 3 ? "bg-gradient-to-br from-orange-50 to-white border-orange-100 shadow-orange-100/30" : "bg-white border-slate-100";
              const textClass = 
                rank === 1 ? "text-amber-600" :
                rank === 2 ? "text-slate-500" :
                rank === 3 ? "text-orange-600" : "text-slate-600";
              const accentColor = 
                rank === 1 ? "#d97706" :
                rank === 2 ? "#475569" :
                rank === 3 ? "#ea580c" : "#64748b";
              
              return (
                <div 
                  key={performer.id} 
                  className={`flex flex-col gap-4 group`}
                >
                  <div 
                    onClick={() => setExpandedUser(isExpanded ? null : performer.id)}
                    className={`relative overflow-hidden p-6 rounded-[2rem] border-2 transition-all hover:shadow-2xl hover:-translate-y-2 cursor-pointer ${bgClass} ${isExpanded ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    style={{ borderBottomColor: accentColor + '80' }}
                  >
                    {rank === 1 && (
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <MdWorkspacePremium size={100} className="text-amber-500" />
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-16 h-16">
                        <PerformerAvatar avatar={performer.avatar} name={performer.name} rank={rank} entityType={aggregationLevel} />
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Rank</p>
                        <div className="flex items-center justify-end gap-1">
                          <MdWorkspacePremium size={16} className={textClass} />
                          <p className={`text-2xl font-black italic tracking-tighter ${textClass}`}>#{rank}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 leading-none truncate mb-1">{performer.name}</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{performer.jobTitle}</p>
                      <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${textClass}/70`}>{performer.department}</p>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <div className="bg-white/60 backdrop-blur-sm p-3 rounded-2xl border border-white shadow-sm">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Score</p>
                        <p className={`text-sm font-black ${textClass}`}>{formatScore(performer.avgScore)}</p>
                      </div>
                      <div className="bg-white/60 backdrop-blur-sm p-3 rounded-2xl border border-white shadow-sm">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Value</p>
                        <p className="text-sm font-black text-slate-900">{formatValue(performer.totalValue)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {isExpanded ? "Click to collapse" : "Click to view detail"}
                      {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      {renderDetails(performer)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Full List / Others */}
        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-center">Rank</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{isDeptLevel ? "Department" : isTeamLevel ? "Team Leader" : "Employee"}</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Progress</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Total</th>
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredList.map((item: any, idx: number) => {
                const actualRank = idx + 1;
                const isExpanded = expandedRow === item.id;
                return (
                  <React.Fragment key={item.id}>
                    <tr 
                      onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                      className={`hover:bg-slate-50 transition-colors group cursor-pointer ${isExpanded ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <span className={`flex w-7 h-7 rounded-lg items-center justify-center text-xs font-black ${actualRank <= 3 ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"}`}>
                          {actualRank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 shrink-0">
                            <PerformerAvatar avatar={item.avatar} name={item.name} entityType={aggregationLevel} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 leading-tight">{item.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider line-clamp-1">{item.jobTitle || item.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5 max-w-[120px]">
                          <div className="flex justify-between items-center text-[10px] font-black text-slate-500">
                            <span>{formatScore(item.avgScore)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all duration-700"
                              style={{ width: `${Math.min(100, item.avgScore || 0)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 font-bold text-slate-900">
                          <span>{formatValue(item.totalValue)}</span>
                          <span className="text-[8px] text-slate-400 uppercase tracking-widest">ETB</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isExpanded ? "bg-primary text-white rotate-180" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600"}`}>
                          <MdExpandMore size={18} />
                        </div>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-6 pb-6 pt-2 bg-slate-50/30">
                          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm ring-1 ring-slate-900/5">
                              <div className="flex items-center justify-between mb-6">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                  <div className="w-1 h-3 bg-primary rounded-full" />
                                  Performance Details
                                </h4>
                                <div className="flex gap-4">
                                  <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Value</p>
                                    <p className="text-xs font-black text-emerald-600">{formatValue(item.totalValue)} ETB</p>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-5">
                                {item.objectives?.map((obj: any) => (
                                  <div key={obj.id} className="bg-white rounded-[2rem] border border-slate-100 p-7 shadow-sm hover:shadow-md transition-all ring-1 ring-slate-900/5">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-3">
                                          <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase tracking-widest">Core Objective</span>
                                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${obj.score >= 70 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                                            {formatScore(obj.score)}
                                          </span>
                                        </div>
                                        <h5 className="text-base font-black text-slate-900 leading-tight">{obj.title}</h5>
                                      </div>
                                      <div className="bg-slate-50 rounded-2xl px-5 py-3 border border-slate-100 flex flex-col items-end shrink-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impact Value</p>
                                        <p className="text-base font-black text-slate-900">{formatValue(obj.value)} <span className="text-xs text-slate-400">ETB</span></p>
                                      </div>
                                    </div>

                                    {/* Key Results Nesting */}
                                    {obj.krs && obj.krs.length > 0 && (
                                      <div className="mt-2 pt-6 border-t border-slate-100">
                                        <div className="flex items-center gap-3 mb-5">
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Key Results Underpinning Performance</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {obj.krs.map((kr: any) => (
                                            <div key={kr.id} className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 group/kr hover:border-primary/30 hover:bg-white transition-all">
                                              <div className="flex justify-between items-start gap-4 mb-4">
                                                <p className="text-xs font-bold text-slate-700 leading-tight group-hover/kr:text-primary transition-colors">{kr.title}</p>
                                                <div className="flex flex-col items-end">
                                                  <span className="text-xs font-black text-slate-900">{formatScore(kr.score)}</span>
                                                  <span className="text-[8px] text-slate-400 font-bold uppercase">Score</span>
                                                </div>
                                              </div>
                                              <div className="flex items-center justify-between pt-4 border-t border-slate-200/40">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest line-clamp-1">{kr.metric}</span>
                                                </div>
                                                <span className="text-[11px] font-black text-slate-700">{formatValue(kr.value)} ETB</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {(!item.objectives || item.objectives.length === 0) && (
                                  <div className="py-10 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                                    <p className="text-sm text-slate-400 italic">No detailed objectives archived for this performer.</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBottlenecks = () => {
    const bottlenecks = payload.bottlenecks || [];
    if (bottlenecks.length === 0) return <p className="text-sm text-slate-500">No major bottlenecks identified.</p>;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {bottlenecks.map((item: any) => {
          const isExpanded = expandedObj === item.id;
          return (
            <div 
              key={item.id} 
              onClick={() => setExpandedObj(isExpanded ? null : item.id)}
              className={`group bg-white p-5 rounded-3xl border transition-all cursor-pointer hover:shadow-lg ${isExpanded ? "border-rose-200 shadow-rose-100/50" : "border-slate-100 hover:border-rose-100"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 shrink-0 group-hover:scale-110 transition-transform">
                  <MdTrendingDown size={20} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Score</p>
                  <p className="text-lg font-black text-rose-600">{formatScore(item.final_score)}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-bold text-slate-900 leading-snug">{item.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <MdPerson size={14} className="text-slate-400" />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{item.owner}</p>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-50 animate-in fade-in slide-in-from-top-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Parent Objective</p>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{item.objective}</p>
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 text-slate-500">
                    <MdError size={14} className={item.final_score < 30 ? "text-rose-500" : "text-amber-500"} />
                    <span className="text-[10px] font-bold">
                      {item.final_score < 30 ? "Critical Bottleneck" : "Needs Attention"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCompletionRate = () => {
    const { totalKRs, completedKRs, partialKRs, completionRate, successRate } = payload;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                <MdCheckCircleOutline size={24} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Completed</p>
                <p className="text-2xl font-black text-emerald-600">{completedKRs}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Completion</span>
                <span>{formatScore(completionRate)}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                <MdAssignmentTurnedIn size={24} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">On Track (70%+)</p>
                <p className="text-2xl font-black text-primary">{(partialKRs || 0) + (completedKRs || 0)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Success Rate</span>
                <span>{formatScore(successRate)}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${successRate}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-slate-50 text-slate-400">
                <MdSort size={24} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total KRs</p>
                <p className="text-2xl font-black text-slate-900">{totalKRs}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-medium">Total registered key results in this cycle.</p>
          </div>
        </div>
      </div>
    );
  };

  const renderBlockerSummaries = () => {
    const blockers = payload.recentBlockers || [];
    if (blockers.length === 0) return <p className="text-sm text-slate-500">No active blockers reported.</p>;

    return (
      <div className="space-y-4">
        {blockers.map((b: any, i: number) => {
          const isExpanded = expandedObj === i;
          return (
            <div 
              key={i} 
              onClick={() => setExpandedObj(isExpanded ? null : i)}
              className={`bg-white rounded-2xl border p-4 transition-all cursor-pointer hover:shadow-md ${isExpanded ? "border-amber-200 shadow-amber-100/50" : "border-slate-100"}`}
            >
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${b.confidence_level === 'OFF_TRACK' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                    <MdWarning size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{b.owner}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5">{b.kr_title}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Reported</p>
                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{new Date(b.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-50 animate-in fade-in slide-in-from-top-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Blocker Description</p>
                  <div className="p-3 rounded-xl bg-slate-50 text-sm text-slate-700 leading-relaxed italic border-l-4 border-amber-400">
                    "{b.blockers}"
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderAlignment = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { label: "Department Alignment", value: payload.departmentAlignmentPercent, color: "text-primary", icon: <MdLink size={24} /> },
          { label: "Employee Alignment", value: payload.employeeAlignmentPercent, color: "text-violet-600", icon: <MdPerson size={24} /> },
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6">
            <div className={`p-4 rounded-2xl bg-slate-50 ${item.color} shrink-0`}>
              {item.icon}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-black tracking-tighter ${item.color}`}>{item.value}%</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                  Perfect
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCadence = () => {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Adherence Rate</h5>
            <p className="text-xs text-slate-400">Quarterly update consistency across all teams</p>
          </div>
          <span className="text-4xl font-black tracking-tighter text-primary">{(payload.adherenceRate || 0).toFixed(1)}%</span>
        </div>
        <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full shadow-inner transition-all duration-1000" 
            style={{ width: `${payload.adherenceRate || 0}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Plans</p>
            <p className="text-xl font-black text-slate-900">{payload.totalPlans}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Completed Plans</p>
            <p className="text-xl font-black text-emerald-600">{payload.completedPlans}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderLatePublishing = () => {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <MdSchedule size={32} />
        </div>
        <h5 className="text-lg font-black text-slate-900 tracking-tight">Late Publishing Events</h5>
        <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto mb-6">
          Objectives published after the cycle's official start date. Minimizing this ensures better focus and alignment.
        </p>
        <div className="inline-flex items-baseline gap-2 px-8 py-4 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-5xl font-black tracking-tighter text-amber-600">{payload.latePublishCount}</span>
          <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Events</span>
        </div>
      </div>
    );
  };

  // Main switch logic
  const renderContent = () => {
    if (type === "top_performers" || type === "top_performers_team" || type === "top_performers_department") {
      return renderTopPerformers();
    }
    
    switch (type) {
      case "bottlenecks": return renderBottlenecks();
      case "completion_rate": return renderCompletionRate();
      case "blocker_summaries": return renderBlockerSummaries();
      case "alignment_coverage": return renderAlignment();
      case "cadence_adherence": return renderCadence();
      case "late_publishing": return renderLatePublishing();
      default: return (
        <div className="rounded-2xl bg-white border border-slate-100 p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
          {JSON.stringify(payload, null, 2)}
        </div>
      );
    }
  };

  return <div className="mt-4">{renderContent()}</div>;
};

export default InsightRenderer;
