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
  MdInsights,
  MdSettings,
  MdAutoGraph,
  MdTimeline,
} from "react-icons/md";
import RefreshButton from "../../../components/common/RefreshButton";
import { useNavigate } from "react-router-dom";

type CompanyObjectiveRow = {
  id: number;
  status: string;
  krCount: number;
  progress: number;
};

function normalizeObjectiveList(raw: unknown): CompanyObjectiveRow[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((o: any) => {
    const tgt = Number(o.target_value ?? 0);
    const cur = Number(o.current_value ?? 0);
    const pct = tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
    return {
      id: Number(o.id),
      status: (o.status_code || o.status || "draft").toLowerCase(),
      krCount: o._count?.keyResults ?? 0,
      progress: pct,
    };
  });
}

async function fetchDepartmentObjectiveTotal(cycleId: number): Promise<number> {
  try {
    const res = await makeCall({
      method: "GET",
      route: apiRoutes.okr.departmentObjectives,
      query: { cycle_id: cycleId },
      isSecureRoute: true,
    });
    const data = res?.data?.data ?? res?.data;
    if (Array.isArray(data)) {
      return data.length;
    }
  } catch {
    /* fall through to per-department sum */
  }

  try {
    const depRes = await makeCall({
      method: "GET",
      route: apiRoutes.departments,
      query: { page: 1, limit: 500 },
      isSecureRoute: true,
    });
    const departments = depRes?.data?.data?.department ?? [];
    if (!Array.isArray(departments) || departments.length === 0) {
      return 0;
    }

    const results = await Promise.all(
      departments.map(async (dep: { id: number }) => {
        try {
          const r = await makeCall({
            method: "GET",
            route: apiRoutes.okr.departmentObjectives,
            query: { department_id: dep.id, cycle_id: cycleId },
            isSecureRoute: true,
          });
          const rows = r?.data?.data ?? r?.data;
          return Array.isArray(rows) ? rows.length : 0;
        } catch {
          return 0;
        }
      }),
    );
    return results.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
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

      const objRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.companyObjectives,
        query: { cycle_id: cid },
        isSecureRoute: true,
      });

      const raw = objRes?.data?.data ?? objRes?.data ?? [];
      const rows = normalizeObjectiveList(raw);
      setObjectives(rows);

      const deptTotal = await fetchDepartmentObjectiveTotal(cid);
      setDepartmentObjTotal(deptTotal);
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
    const totalKRs = objectives.reduce((s, o) => s + o.krCount, 0);
    const avgProgress =
      n > 0
        ? Math.round(objectives.reduce((s, o) => s + o.progress, 0) / n)
        : 0;
    return { n, published, draft, totalKRs, avgProgress };
  }, [objectives]);

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
  const statCardClass =
    "rounded-2xl bg-white p-5 shadow-sm flex flex-col gap-3 min-h-[120px]";

  const publicationBreakdown = useMemo(() => {
    const total = Math.max(companySummary.n, 1);
    const published = Math.round((companySummary.published / total) * 100);
    const draft = Math.max(0, 100 - published);
    return { published, draft };
  }, [companySummary.n, companySummary.published]);

  const objectiveProgressPreview = useMemo(() => {
    return objectives.slice(0, 6).map((o) => ({
      id: o.id,
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
                    <h1 className="text-2xl font-black tracking-tighter text-white">
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

          <main className="mt-8 min-w-0 space-y-6">
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <article className="lg:col-span-8 rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs tracking-widest font-semibold text-k-medium-grey">
                      Active Cycle
                    </p>
                    {loading ? (
                      <div className="h-8 w-56 bg-gray-100 rounded-lg animate-pulse mt-2" />
                    ) : (
                      <h2 className="text-2xl font-bold text-k-dark-grey mt-1">
                        {currentCycleName || "No active cycle"}
                      </h2>
                    )}
                    {!loading && cycleStart && cycleEnd ? (
                      <p className="text-sm text-k-medium-grey mt-1">
                        {formatShortDate(cycleStart)} —{" "}
                        {formatShortDate(cycleEnd)}
                      </p>
                    ) : null}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl bg-k-light-grey px-3 py-2">
                    <MdAutoGraph className="text-primary text-lg" />
                    <span className="text-xs font-semibold text-k-dark-grey">
                      Live Pulse
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                  <div className={statCardClass}>
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <MdLayers className="text-lg text-primary shrink-0" />
                      <span>Cycles</span>
                    </div>
                    {loading ? (
                      <div className="h-8 w-14 bg-gray-100 rounded animate-pulse" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-k-dark-grey">
                          {totalCycles}
                        </p>
                        <p className="text-xs text-k-medium-grey">
                          {openCyclesCount} open
                        </p>
                      </>
                    )}
                  </div>

                  <div className={statCardClass}>
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <MdPublishedWithChanges className="text-lg text-primary shrink-0" />
                      <span>Objectives</span>
                    </div>
                    {loading ? (
                      <div className="h-8 w-14 bg-gray-100 rounded animate-pulse" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-k-dark-grey">
                          {companySummary.n}
                        </p>
                        <p className="text-xs text-k-medium-grey">
                          {companySummary.totalKRs} KRs
                        </p>
                      </>
                    )}
                  </div>

                  <div className={statCardClass}>
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <MdAccountTree className="text-lg text-primary shrink-0" />
                      <span>Department OKRs</span>
                    </div>
                    {loading ? (
                      <div className="h-8 w-14 bg-gray-100 rounded animate-pulse" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-k-dark-grey">
                          {departmentObjTotal ?? "—"}
                        </p>
                        <p className="text-xs text-k-medium-grey">
                          Linked execution
                        </p>
                      </>
                    )}
                  </div>

                  <div className={statCardClass}>
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <MdTrendingUp className="text-lg text-primary shrink-0" />
                      <span>Progress</span>
                    </div>
                    {loading ? (
                      <div className="h-8 w-14 bg-gray-100 rounded animate-pulse" />
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-k-dark-grey">
                          {currentCycleId
                            ? `${companySummary.avgProgress}%`
                            : "—"}
                        </p>
                        <p className="text-xs text-k-medium-grey">
                          Cycle average
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </article>

              <article className="lg:col-span-4 rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs tracking-widest font-semibold text-k-medium-grey">
                    Publication mix
                  </p>
                  {/*<MdPublishedWithChanges className="text-primary text-lg" />*/}
                </div>
                {loading ? (
                  <div className="h-32 mt-4 bg-gray-100 rounded-xl animate-pulse" />
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="h-3 w-full rounded-full bg-k-light-grey overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${publicationBreakdown.published}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-k-dark-grey font-medium">
                        Published {publicationBreakdown.published}%
                      </span>
                      <span className="text-k-medium-grey">
                        Draft {publicationBreakdown.draft}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-k-light-grey/70 px-3 py-2">
                        <p className="text-k-medium-grey tracking-wider">
                          Published
                        </p>
                        <p className="text-base font-semibold text-k-dark-grey">
                          {companySummary.published}
                        </p>
                      </div>
                      <div className="rounded-xl bg-k-light-grey/70 px-3 py-2">
                        <p className="text-k-medium-grey tracking-wider">
                          Draft
                        </p>
                        <p className="text-base font-semibold text-k-dark-grey">
                          {companySummary.draft}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs tracking-widest font-semibold text-k-medium-grey">
                    Objective Signal
                  </p>
                  <h3 className="text-lg font-bold text-k-dark-grey mt-1">
                    Progress Snapshot
                  </h3>
                </div>
                <div className="text-xs text-k-medium-grey">
                  Top {objectiveProgressPreview.length} objectives by recency
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-5">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-24 rounded-xl bg-gray-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : objectiveProgressPreview.length === 0 ? (
                <p className="text-sm text-k-medium-grey mt-5">
                  No objective data yet for this cycle.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-5">
                  {objectiveProgressPreview.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-k-light-grey/70 px-3 py-3"
                    >
                      <p className="text-[10px] tracking-wider text-k-medium-grey">
                        Obj {item.id}
                      </p>
                      <div className="mt-2 h-14 rounded-lg bg-white/80 p-2 flex items-end">
                        <div className="w-full bg-primary/20 rounded-md h-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-md transition-all duration-500"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-k-dark-grey">
                        {item.progress}%
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/*<article className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 transition-all hover:shadow-md">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black tracking-widest font-space">
                  <MdInsights className="text-primary text-sm" />
                  <span>Navigation</span>
                </div>
                <h4 className="text-lg font-bold text-slate-900 mt-2">
                  Strategic Views
                </h4>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Jump into executive analytics and portfolio-wide OKR health.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      navigate(routeConstants.okrCeoStrategicDashboard)
                    }
                    className="px-4 py-2 text-[10px] font-black tracking-widest font-space bg-slate-50 text-slate-900 rounded-xl ring-1 ring-slate-200 hover:bg-slate-100 transition-all"
                  >
                    CEO Dashboard
                  </button>
                  <button
                    onClick={() =>
                      navigate(routeConstants.okrDepartmentComparison)
                    }
                    className="px-4 py-2 text-[10px] font-black tracking-widest font-space bg-slate-50 text-slate-900 rounded-xl ring-1 ring-slate-200 hover:bg-slate-100 transition-all"
                  >
                    Department Comparison
                  </button>
                </div>
              </article>*/}

              {/*<article className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 transition-all hover:shadow-md">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black tracking-widest font-space">
                  <MdSettings className="text-primary text-sm" />
                  <span>Controls</span>
                </div>
                <h4 className="text-lg font-bold text-slate-900 mt-2">
                  Configuration & Audit
                </h4>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Maintain cycle standards and review governance history.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate(routeConstants.okrConfiguration)}
                    className="px-4 py-2 text-[10px] font-black tracking-widest font-space bg-slate-50 text-slate-900 rounded-xl ring-1 ring-slate-200 hover:bg-slate-100 transition-all"
                  >
                    Configuration
                  </button>
                  <button
                    onClick={() => navigate(routeConstants.okrAuditLogs)}
                    className="px-4 py-2 text-[10px] font-black tracking-widest font-space bg-slate-50 text-slate-900 rounded-xl ring-1 ring-slate-200 hover:bg-slate-100 transition-all"
                  >
                    Audit Logs
                  </button>
                </div>
              </article>*/}
            </section>
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}
