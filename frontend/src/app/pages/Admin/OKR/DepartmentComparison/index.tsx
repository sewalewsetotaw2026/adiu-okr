import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import { okrFeatureFlags } from "../okrFeatureFlags";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { okrAsArray, okrErrorMessage, okrUnwrap } from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import { useNavigate } from "react-router-dom";
import { routeConstants } from "../../../../../utils/constants";
import { MdChevronRight, MdCompareArrows, MdAutoGraph, MdAssessment, MdOutlinedFlag } from "react-icons/md";
import Button from "../../../../components/Core/ui/Button";

type DepartmentRow = {
  id: number;
  name: string;
  objectiveCount: number;
  krCount: number;
  completedKrs: number;
  score: number;
  indirectScore: number;
  value: number;
  completion: number;
};

type SortKey = "score" | "value" | "completion";

export default function DepartmentComparisonPage() {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DepartmentRow[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = okrUnwrap<any>(cycleRes);
      const cid = cycle?.id != null ? Number(cycle.id) : null;
      if (!cid) {
        setRows([]);
        return;
      }

      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.dashboardDepartmentsCompare,
        query: { cycle_id: cid },
        isSecureRoute: true,
      });
      const body = okrUnwrap<any>(res) ?? {};
      const deps = okrAsArray<any>(body.departments ?? []);
      setRows(
        deps.map((d) => ({
          id: Number(d.departmentId),
          name: String(d.departmentName ?? "Department"),
          objectiveCount: Number(d.objectiveCount ?? 0) || 0,
          krCount: Number(d.krCount ?? 0) || 0,
          completedKrs: Number(d.completedKRs ?? 0) || 0,
          score: Number(d.avgScore ?? 0) || 0,
          indirectScore: Number(d.avgIndirectScore ?? 0) || 0,
          value: Number(d.totalValue ?? 0) || 0,
          completion: Number(d.completionRate ?? 0) || 0,
        })),
      );
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (okrFeatureFlags.leadershipPages) void load();
  }, [load]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b[sortBy] - a[sortBy]),
    [sortBy, rows],
  );

  if (!okrFeatureFlags.leadershipPages) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-slate-50 p-8 text-center text-gray-500 text-sm">
          Comparison disabled (feature flag).
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-2 space-y-6">
          <nav className="flex flex-wrap items-center gap-2 text-sm pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(routeConstants.okr)}
              className="text-gray-500 hover:text-gray-800 transition-colors p-0 h-auto font-normal"
            >
              OKR
            </Button>
            <MdChevronRight className="text-gray-300 shrink-0 text-lg" />
            <span className="text-gray-800 font-medium">Department comparison</span>
          </nav>

          <PageHeader>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-start gap-3 text-white">
                  <div className="rounded-xl bg-white/10 p-2 border border-white/10 shrink-0 shadow-inner">
                    <MdCompareArrows className="text-2xl" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black tracking-tighter capitalize">
                      Department Comparison
                    </h1>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded border border-white/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-black text-white/90 uppercase tracking-widest font-space">
                          Live Metrics
                        </span>
                      </div>
                      <p className="text-white/60 text-[10px] font-black uppercase tracking-widest font-space">
                        Performance benchmarks across all departments
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <RefreshButton 
                  onClick={load} 
                  loading={loading} 
                  className="bg-white !text-slate-900 shadow-md ring-1 ring-slate-200"
                />
              </div>
            </div>
          </PageHeader>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">Sort Benchmark By</span>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="appearance-none rounded-xl border border-slate-200 pl-4 pr-10 py-2 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer hover:border-primary/30"
                >
                  <option value="score">Efficiency Score</option>
                  <option value="value">Business Value</option>
                  <option value="completion">Completion Rate</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <MdChevronRight className="rotate-90" />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <MdAutoGraph className="text-primary text-lg" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-space">
                Showing {rows.length} Active Departments
              </span>
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {loading ? (
              <>
                <div className="h-48 rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 animate-pulse" />
                <div className="h-48 rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 animate-pulse" />
                <div className="h-48 rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 animate-pulse" />
                <div className="h-48 rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 animate-pulse" />
              </>
            ) : sorted.length === 0 ? (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                  <MdAssessment className="text-3xl text-slate-300" />
                </div>
                <div>
                  <p className="text-slate-900 font-bold uppercase tracking-widest font-space text-xs">No Comparison Data</p>
                  <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-space mt-1">Initialize department objectives to see metrics</p>
                </div>
              </div>
            ) : (
              sorted.map((r, idx) => (
                <article
                  key={r.id}
                  className="group relative rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40 hover:border-primary/20 transition-all overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4">
                    <span className="text-[40px] font-black text-slate-50/50 italic leading-none select-none">
                      #{idx + 1}
                    </span>
                  </div>
                  
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] font-space mb-2">Department</p>
                    <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-primary transition-colors capitalize">
                      {r.name}
                    </h3>
                    
                    <div className="mt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                            <MdOutlinedFlag className="text-slate-400" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-space">Volume</p>
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest font-space">
                              {r.objectiveCount} Obj · {r.krCount} KR
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-50 grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-space">Direct</p>
                          <p className="text-xl font-black text-slate-900 tracking-tighter">{r.score}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-space">Indirect</p>
                          <p className="text-xl font-black text-slate-900 tracking-tighter">{r.indirectScore}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-space">Done</p>
                          <p className="text-xl font-black text-slate-900 tracking-tighter">{r.completion}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-[10px] font-black text-slate-900 tracking-[0.2em] font-space capitalize">Comparative Grid</h2>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8">
                  <LoadingSkeleton variant="table-row" count={5} />
                </div>
              ) : (
                <table className="w-full text-left align-middle">
                  <thead>
                    <tr className="bg-slate-50/30">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">Department</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space text-center">Direct</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space text-center">Indirect</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space text-center">Done</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space text-center">Value</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space text-center">Comp. KR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sorted.map((r) => (
                      <tr key={r.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-900 uppercase tracking-widest font-space text-xs">{r.name}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-black text-slate-700 tracking-tighter">{r.score}%</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-black text-slate-700 tracking-tighter">{r.indirectScore}%</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-black text-slate-700 tracking-tighter">{r.value}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-black text-slate-700 tracking-tighter">{r.completion}%</span>
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-1000" 
                                style={{ width: `${r.completion}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black font-space">
                            {r.completedKrs}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* HR Insight Graph */}
          {/* <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-500">
                  <MdAutoGraph className="text-xl" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tighter capitalize">HR Performance Insight</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-space mt-0.5">
                    Visual breakdown of department KPIs
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest font-space text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Score</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Value</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Completion</span>
              </div>
            </div>
            {loading ? (
              <LoadingSkeleton variant="table-row" count={3} />
            ) : rows.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No data to visualize</p>
            ) : (
              <div className="space-y-5">
                {sorted.map((r) => {
                  const maxScore = Math.max(...rows.map((x) => x.score), 1);
                  const maxValue = Math.max(...rows.map((x) => x.value), 1);
                  return (
                    <div key={r.id} className="group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-900 uppercase tracking-widest font-space">{r.name}</span>
                        <div className="flex gap-4 text-[10px] font-bold text-slate-500">
                          <span>{r.score}% score</span>
                          <span>{r.value} value</span>
                          <span>{r.completion}% done</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min((r.score / maxScore) * 100, 100)}%` }}
                          />
                        </div>
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min((r.value / maxValue) * 100, 100)}%` }}
                          />
                        </div>
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all duration-1000"
                            style={{ width: `${r.completion}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section> */}
        </div>
      </div>
    </AdminLayout>
  );
}
