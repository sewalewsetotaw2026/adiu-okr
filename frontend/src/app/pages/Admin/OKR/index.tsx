import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../components/common/PageHeader";

import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import { routeConstants } from "../../../../utils/constants";

import { useCycleSlice } from "./CycleManagement/slice";
import {
  selectCycles,
  selectCycleLoading,
} from "./CycleManagement/slice/selectors";

import {
  MdAccountTree,
  MdTrendingUp,
  MdLayers,
  MdPublishedWithChanges,
  MdAutoGraph,
  MdTimeline,
} from "react-icons/md";
import RefreshButton from "../../../components/common/RefreshButton";
import { useNavigate } from "react-router-dom";

type CompanyObjectiveRow = {
  id: number;
  title: string;
  status: string;
  krCount: number;
  progress: number;
};

function normalizeObjectiveList(raw: unknown): CompanyObjectiveRow[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((o: any) => {
    // In our system, final_score is the percentage completion (0-100)
    const pct = Number(o.final_score ?? 0);
    return {
      id: Number(o.id),
      title: o.title || `Objective ${o.id}`,
      status: (o.status_code || o.status || "draft").toLowerCase(),
      krCount: o._count?.keyResults ?? o.keyResults?.length ?? 0,
      progress: pct,
    };
  });
}


export default function OKRDashboard() {
  const dispatch = useDispatch();
  const { actions: cycleActions } = useCycleSlice();

  const cyclesRaw = useSelector(selectCycles);
  const cyclesLoading = useSelector(selectCycleLoading);

  const [statsLoading, setStatsLoading] = useState(true);
  const [currentCycleName, setCurrentCycleName] = useState<string | null>(null);
  const [currentCycleId, setCurrentCycleId] = useState<number | null>(null);
  const [cycleStart, setCycleStart] = useState<string | null>(null);
  const [cycleEnd, setCycleEnd] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<CompanyObjectiveRow[]>([]);
  const [departmentObjTotal, setDepartmentObjTotal] = useState<number | null>(
    null,
  );
  const [ceoData, setCeoData] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);

  const navigate = useNavigate();

  const loadCycleStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });

      const cycle = cycleRes?.data?.data ?? cycleRes?.data ?? cycleRes ?? null;

      const cid = cycle?.id != null ? Number(cycle.id) : null;
      setCurrentCycleId(cid);
      setCurrentCycleName(
        typeof cycle?.name === "string"
          ? cycle.name
          : cid
            ? "Active cycle"
            : null,
      );

      const sd = cycle?.start_date ?? cycle?.startDate;
      const ed = cycle?.end_date ?? cycle?.endDate;
      setCycleStart(typeof sd === "string" ? sd.split("T")[0] : null);
      setCycleEnd(typeof ed === "string" ? ed.split("T")[0] : null);

      if (!cid) {
        setObjectives([]);
        setDepartmentObjTotal(0);
        return;
      }

      const [objRes, ceoRes, snapRes] = await Promise.all([
        makeCall({
          method: "GET",
          route: apiRoutes.okr.companyObjectives,
          query: { cycle_id: cid },
          isSecureRoute: true,
        }),
        makeCall({
          method: "GET",
          route: apiRoutes.okr.dashboardCeo,
          query: { cycle_id: cid },
          isSecureRoute: true,
        }),
        makeCall({
          method: "GET",
          route: apiRoutes.okr.dashboardSnapshots(cid),
          isSecureRoute: true,
        }),
      ]);

      const raw = objRes?.data?.data ?? objRes?.data ?? [];
      const rows = normalizeObjectiveList(raw);
      setObjectives(rows);

      const cData = ceoRes?.data?.data ?? ceoRes?.data ?? null;
      setCeoData(cData);

      const sData = snapRes?.data?.data ?? snapRes?.data ?? [];
      setSnapshots(sData);

      setDepartmentObjTotal(cData?.summary?.totalDepartmentObjectives ?? 0);
    } catch (e) {
      console.error("OKR dashboard stats", e);
      setCurrentCycleId(null);
      setCurrentCycleName(null);
      setObjectives([]);
      setDepartmentObjTotal(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    dispatch(cycleActions.fetchCyclesRequest());
    loadCycleStats();
  }, [dispatch, cycleActions, loadCycleStats]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    loadCycleStats();
  }, [loadCycleStats]);

  const openCyclesCount = useMemo(() => {
    return (cyclesRaw || []).filter((c: { status?: string }) => {
      const s = (c.status || "").toUpperCase();
      return s === "OPEN";
    }).length;
  }, [cyclesRaw]);

  const totalCycles = (cyclesRaw || []).length;

  const companySummary = useMemo(() => {
    const n = objectives.length;
    const published = objectives.filter((o) => o.status === "published").length;
    const draft = n - published;
    const totalKRs = ceoData?.summary?.totalKRs ?? objectives.reduce((s, o) => s + o.krCount, 0);
    const avgProgress = ceoData?.summary?.avgCompanyScore != null 
      ? Math.round(Number(ceoData.summary.avgCompanyScore)) 
      : n > 0 
        ? Math.round(objectives.reduce((s, o) => s + o.progress, 0) / n) 
        : 0;
    return { n, published, draft, totalKRs, avgProgress };
  }, [objectives, ceoData]);

  const formatShortDate = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso + "T12:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const loading = cyclesLoading || statsLoading;

  const publicationBreakdown = useMemo(() => {
    const total = Math.max(companySummary.n, 1);
    const published = Math.round((companySummary.published / total) * 100);
    const draft = Math.max(0, 100 - published);
    return { published, draft };
  }, [companySummary.n, companySummary.published]);

  const objectiveProgressPreview = useMemo(() => {
    return objectives.slice(0, 6).map((o) => ({
      id: o.id,
      title: o.title,
      progress: Math.max(0, Math.min(100, Number(o.progress || 0))),
    }));
  }, [objectives]);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-2">
          <PageHeader>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner">
                    <MdTimeline className="text-3xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tighter text-white capitalize">
                      OKR Orchestration
                    </h1>
                    <p className="text-white/60 text-xs font-medium mt-1">
                      Strategic pulse for cycle health, publication readiness,
                      and execution depth.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <RefreshButton onClick={refreshAll} loading={loading} />
                </div>
              </div>
            </div>
          </PageHeader>

          <main className="mt-8 space-y-6">
            {/* Section 1: Active Cycle & Core Metrics */}
            <section className="rounded-2xl bg-white p-8 shadow-sm border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-50">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl">
                    <MdAutoGraph className="text-3xl text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.2em] font-black text-slate-400 uppercase">
                      Current Performance Cycle
                    </p>
                    {loading ? (
                      <div className="h-8 w-56 bg-slate-100 rounded-lg animate-pulse mt-2" />
                    ) : (
                      <h2 className="text-3xl font-black text-slate-900 mt-1 tracking-tight capitalize">
                        {currentCycleName || "No active cycle"}
                      </h2>
                    )}
                    {!loading && cycleStart && cycleEnd ? (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                          LIVE
                        </span>
                        <p className="text-sm text-slate-500 font-medium">
                          {formatShortDate(cycleStart)} —{" "}
                          {formatShortDate(cycleEnd)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                <div className="group rounded-2xl bg-slate-50/50 p-6 transition-all hover:bg-white hover:shadow-xl hover:shadow-primary/5 ring-1 ring-slate-100 hover:ring-primary/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-primary">
                      <MdLayers className="text-xl" />
                    </div>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Total Cycles
                  </p>
                  {loading ? (
                    <div className="h-8 w-12 bg-slate-200 rounded animate-pulse mt-1" />
                  ) : (
                    <div className="flex items-end gap-2 mt-1">
                      <p className="text-3xl font-black text-slate-900">
                        {totalCycles}
                      </p>
                      <p className="text-xs text-primary font-bold mb-1">
                        {openCyclesCount} ACTIVE
                      </p>
                    </div>
                  )}
                </div>

                <div className="group rounded-2xl bg-slate-50/50 p-6 transition-all hover:bg-white hover:shadow-xl hover:shadow-primary/5 ring-1 ring-slate-100 hover:ring-primary/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-primary">
                      <MdPublishedWithChanges className="text-xl" />
                    </div>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Objectives
                  </p>
                  {loading ? (
                    <div className="h-8 w-12 bg-slate-200 rounded animate-pulse mt-1" />
                  ) : (
                    <div className="flex items-end gap-2 mt-1">
                      <p className="text-3xl font-black text-slate-900">
                        {companySummary.n}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mb-1">
                        {companySummary.totalKRs} KEY RESULTS
                      </p>
                    </div>
                  )}
                </div>

                <div className="group rounded-2xl bg-slate-50/50 p-6 transition-all hover:bg-white hover:shadow-xl hover:shadow-primary/5 ring-1 ring-slate-100 hover:ring-primary/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-primary">
                      <MdAccountTree className="text-xl" />
                    </div>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Dept Objectives
                  </p>
                  {loading ? (
                    <div className="h-8 w-12 bg-slate-200 rounded animate-pulse mt-1" />
                  ) : (
                    <div className="flex items-end gap-2 mt-1">
                      <p className="text-3xl font-black text-slate-900">
                        {departmentObjTotal ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mb-1 uppercase">
                        Dept OKRs
                      </p>
                    </div>
                  )}
                </div>

                <div className="group rounded-2xl bg-primary p-6 transition-all shadow-lg shadow-primary/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-white/20 rounded-xl text-white">
                      <MdTrendingUp className="text-xl" />
                    </div>
                  </div>
                  <p className="text-xs font-bold text-white/60 uppercase tracking-wider">
                    Cycle Progress
                  </p>
                  {loading ? (
                    <div className="h-8 w-12 bg-white/20 rounded animate-pulse mt-1" />
                  ) : (
                    <div className="flex items-end gap-2 mt-1">
                      <p className="text-3xl font-black text-white">
                        {currentCycleId ? `${companySummary.avgProgress}%` : "—"}
                      </p>
                      <p className="text-xs text-white/60 font-medium mb-1 uppercase tracking-tighter">
                        Avg Completion
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: Publication Mix (New Dedicated Row) */}
            <section className="rounded-2xl bg-white p-8 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] tracking-[0.2em] font-black text-slate-400 uppercase">
                    Execution Readiness
                  </p>
                  <h3 className="text-xl font-black text-slate-900 mt-1 capitalize">
                    Publication Mix
                  </h3>
                </div>
                <div className="hidden md:flex gap-4 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-slate-600">PUBLISHED ({companySummary.published})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <span className="text-slate-400">DRAFT ({companySummary.draft})</span>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="h-24 bg-slate-50 rounded-2xl animate-pulse" />
              ) : (
                <div className="space-y-6">
                  <div className="relative h-4 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(124,58,237,0.4)]"
                      style={{ width: `${publicationBreakdown.published}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ratio</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">
                        {publicationBreakdown.published}% <span className="text-xs text-slate-400 font-bold tracking-tight">to {publicationBreakdown.draft}%</span>
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Objectives</p>
                      <p className="text-2xl font-black text-emerald-600 mt-1">
                        {companySummary.published}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Review</p>
                      <p className="text-2xl font-black text-amber-500 mt-1">
                        {companySummary.draft}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Section 3: Objective Pulse Snapshot */}
            <section className="rounded-2xl bg-white p-8 shadow-sm border border-slate-100">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
                <div>
                  <p className="text-[10px] tracking-[0.2em] font-black text-slate-400 uppercase">
                    Objective Pulse
                  </p>
                  <h3 className="text-xl font-black text-slate-900 mt-1 capitalize">
                    Progress Snapshot
                  </h3>
                </div>
                
                {ceoData?.confidenceDistribution && (
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-black text-emerald-700 uppercase whitespace-nowrap">
                        On Track: {ceoData.confidenceDistribution.ON_TRACK || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-[10px] font-black text-amber-700 uppercase whitespace-nowrap">
                        At Risk: {ceoData.confidenceDistribution.AT_RISK || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-lg border border-rose-100">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      <span className="text-[10px] font-black text-rose-700 uppercase whitespace-nowrap">
                        Off Track: {ceoData.confidenceDistribution.OFF_TRACK || 0}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {snapshots.length > 1 && (
                 <div className="mb-10 p-5 bg-slate-50/50 rounded-3xl border border-slate-100 shadow-inner">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Execution Trend</p>
                        <p className="text-xs text-slate-500 mt-0.5">Historical progress over time</p>
                      </div>
                      {snapshots.length > 1 && (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${ Number(snapshots[snapshots.length-1].score_value) >= Number(snapshots[0].score_value) ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700' }`}>
                          <MdTrendingUp className={Number(snapshots[snapshots.length-1].score_value) < Number(snapshots[0].score_value) ? 'rotate-180' : ''} />
                          <span>
                            {Math.abs(Number(snapshots[snapshots.length-1].score_value) - Number(snapshots[0].score_value)).toFixed(1)}% 
                            {Number(snapshots[snapshots.length-1].score_value) >= Number(snapshots[0].score_value) ? ' growth' : ' decline'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-end gap-1.5 h-16 md:h-20">
                      {snapshots.slice(-15).map((s, i) => (
                        <div 
                          key={i} 
                          className="flex-1 bg-primary/20 hover:bg-primary rounded-t-md transition-all cursor-help relative group/bar"
                          style={{ height: `${Math.max(10, Number(s.score_value))}%` }}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-slate-900 text-white text-[9px] font-bold rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all scale-75 group-hover/bar:scale-100 pointer-events-none whitespace-nowrap z-20 shadow-xl">
                            {new Date(s.snapshot_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            <div className="text-primary-300 mt-0.5">{s.score_value}% Completion</div>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
              )}

              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="h-32 rounded-2xl bg-slate-50 animate-pulse" />
                  ))}
                </div>
              ) : objectiveProgressPreview.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
                    No objective data for this cycle
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {objectiveProgressPreview.map((item) => (
                    <div
                      key={item.id}
                      className="group p-4 rounded-2xl bg-slate-50/50 hover:bg-white border border-transparent hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all"
                    >
                      <div className="flex items-center justify-between mb-4 gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase truncate flex-1">{item.title}</span>
                        <span className="text-[10px] font-black text-primary shrink-0">{item.progress}%</span>
                      </div>
                      <div className="h-12 w-full bg-white rounded-lg p-1.5 ring-1 ring-slate-100">
                        <div className="h-full w-full bg-slate-100 rounded-md overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-700 ease-out"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}
