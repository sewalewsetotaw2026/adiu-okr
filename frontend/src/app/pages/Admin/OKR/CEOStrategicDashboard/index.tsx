import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import Button from "../../../../components/Core/ui/Button";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import { okrFeatureFlags } from "../okrFeatureFlags";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import {
  okrAsArray,
  okrErrorMessage,
  okrUnwrap,
} from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import {
  MdBusinessCenter,
  MdPieChart,
  MdTrendingUp,
  MdWarningAmber,
  MdCameraAlt,
  MdTrackChanges,
  MdOutlineHub,
  MdBarChart,
  MdHistory,
  MdChevronRight,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";

type DeptRow = {
  name: string;
  score: number;
  value: number;
  completion: number;
  risk: number;
  objectiveCount: number;
  krCount: number;
  indirectScore?: number;
};

type AtRiskRow = { kr: string; dept: string; score: number };

type CompanyObjectiveOption = {
  id: number;
  title: string;
};

type CompletionStatusRow = {
  completionRate?: number;
  mandatoryKRs?: number;
  mandatoryCompleted?: number;
  isBlocked?: boolean;
};

export default function CEOStrategicDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rollupRefreshLoading, setRollupRefreshLoading] = useState(false);
  const [snapshotGeneratingLoading, setSnapshotGeneratingLoading] =
    useState(false);
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [totalCompanyObjectives, setTotalCompanyObjectives] = useState(0);
  const [totalCompanyKrs, setTotalCompanyKrs] = useState(0);
  const [avgCompanyScore, setAvgCompanyScore] = useState(0);
  const [totalDepartmentObjectives, setTotalDepartmentObjectives] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [atRiskRows, setAtRiskRows] = useState<AtRiskRow[]>([]);
  const [companyObjectives, setCompanyObjectives] = useState<
    CompanyObjectiveOption[]
  >([]);
  const [selectedCompletionObjectiveId, setSelectedCompletionObjectiveId] =
    useState<number | null>(null);
  const [completionStatus, setCompletionStatus] =
    useState<CompletionStatusRow | null>(null);
  const [recentSnapshots, setRecentSnapshots] = useState<any[]>([]);

  const loadSnapshots = useCallback(async (cid: number) => {
    try {
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.dashboardSnapshots(cid),
        isSecureRoute: true,
      });
      const data = okrAsArray<any>(okrUnwrap<any>(res) ?? []);
      if (data.length > 0) setRecentSnapshots(data);
      return data.length;
    } catch {
      return 0;
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = okrUnwrap<any>(cycleRes);
      const cid = cycle && cycle.id != null ? Number(cycle.id) : Number.NaN;
      if (!Number.isFinite(cid)) {
        setCycleId(null);
        setDepartments([]);
        setAtRiskRows([]);
        setCompanyObjectives([]);
        setSelectedCompletionObjectiveId(null);
        setCompletionStatus(null);
        setRecentSnapshots([]);
        return;
      }
      setCycleId(cid);

      const [ceoRes, deptRes, atRiskRes] = await Promise.all([
        makeCall({
          method: "GET",
          route: apiRoutes.okr.dashboardCeo,
          query: { cycle_id: cid },
          isSecureRoute: true,
        }),
        makeCall({
          method: "GET",
          route: apiRoutes.okr.dashboardDepartmentsCompare,
          query: { cycle_id: cid },
          isSecureRoute: true,
        }),
        makeCall({
          method: "GET",
          route: apiRoutes.okr.dashboardAtRisk,
          query: { cycle_id: cid },
          isSecureRoute: true,
        }),
      ]);

      const ceo = okrUnwrap<any>(ceoRes) ?? {};
      const summary = ceo.summary ?? {};
      setTotalCompanyObjectives(
        Number(summary.totalCompanyObjectives ?? 0) || 0,
      );
      setTotalCompanyKrs(Number(summary.totalCompanyKRs ?? 0) || 0);
      setAvgCompanyScore(Number(summary.avgCompanyScore ?? 0) || 0);
      setTotalDepartmentObjectives(
        Number(summary.totalDepartmentObjectives ?? 0) || 0,
      );
      const ceoSnapshots = okrAsArray<any>(ceo.recentSnapshots);
      if (ceoSnapshots.length > 0) setRecentSnapshots(ceoSnapshots);
      // Also fetch directly from the dedicated endpoint for freshest data.
      void loadSnapshots(cid);

      const ceoObjectives = okrAsArray<any>(ceo.objectives ?? []);
      const objectiveOptions = ceoObjectives
        .map((o) => ({
          id: Number(o?.id),
          title: String(o?.title ?? `Objective #${o?.id}`),
        }))
        .filter((o) => Number.isFinite(o.id));
      setCompanyObjectives(objectiveOptions);
      setSelectedCompletionObjectiveId((prev) => {
        if (prev && objectiveOptions.some((o) => o.id === prev)) return prev;
        return objectiveOptions[0]?.id ?? null;
      });

      const riskBody = okrUnwrap<any>(atRiskRes) ?? {};
      const riskItems = okrAsArray<any>(riskBody.items ?? []);
      setAtRiskRows(
        riskItems.slice(0, 10).map((r) => ({
          kr: String(r.title ?? r.krTitle ?? r.kr_title ?? "KR"),
          dept: String(
            r.departmentName ??
              r.department_name ??
              r.department ??
              r.ownerDepartment ??
              "Dept",
          ),
          score: Number(r.score ?? r.avgScore ?? 0) || 0,
        })),
      );

      const completedObj = Number(summary.completedCompanyObjectives ?? 0) || 0;
      const totalObjectives = Number(summary.totalCompanyObjectives ?? 0) || 0;
      const completion =
        totalObjectives > 0
          ? Math.round((completedObj / Math.max(1, totalObjectives)) * 100)
          : 0;
      setCompletionRate(completion);

      const deptRaw = okrUnwrap<any>(deptRes) ?? {};
      const deptList = okrAsArray<any>((deptRaw as any).departments ?? []);
      setDepartments(
        deptList.map((d) => ({
          name: String(
            d.departmentName ?? d.department_name ?? d.name ?? "Department",
          ),
          score: Number(d.avgScore ?? 0) || 0,
          indirectScore: Number(d.avgIndirectScore ?? 0) || 0,
          value: Number(d.totalValue ?? 0) || 0,
          completion: Number(d.completionRate ?? 0) || 0,
          risk: Number(d.completedKRs ?? 0) || 0,
          objectiveCount: Number(d.objectiveCount ?? 0) || 0,
          krCount: Number(d.krCount ?? 0) || 0,
        })),
      );
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setDepartments([]);
      setAtRiskRows([]);
    } finally {
      setLoading(false);
    }
  }, [loadSnapshots]);

  useEffect(() => {
    const loadCompletion = async () => {
      if (!cycleId) {
        setCompletionStatus(null);
        return;
      }

      const objectiveId =
        selectedCompletionObjectiveId ?? companyObjectives[0]?.id ?? null;
      if (!objectiveId) {
        setCompletionStatus(null);
        return;
      }

      try {
        const completionRes = await makeCall({
          method: "GET",
          route: apiRoutes.okr.dashboardCompletion(objectiveId),
          query: { level: "COMPANY", cycle_id: cycleId },
          isSecureRoute: true,
        });
        const data = okrUnwrap<any>(completionRes) ?? {};
        const nextStatus: CompletionStatusRow = {
          completionRate: Number(data.completionRate ?? 0),
          mandatoryKRs: Number(data.mandatoryKRs ?? 0),
          mandatoryCompleted: Number(data.mandatoryCompleted ?? 0),
          isBlocked: Boolean(data.isBlocked),
        };
        setCompletionStatus(nextStatus);

        const apiCompletionRate =
          Number.isFinite(nextStatus.completionRate) &&
          nextStatus.completionRate != null
            ? Number(nextStatus.completionRate)
            : Number.NaN;
        if (Number.isFinite(apiCompletionRate)) {
          setCompletionRate(Math.round(apiCompletionRate));
        }
      } catch {
        setCompletionStatus(null);
      }
    };

    void loadCompletion();
  }, [cycleId, selectedCompletionObjectiveId, companyObjectives]);

  useEffect(() => {
    if (okrFeatureFlags.leadershipPages) {
      void loadData();
    }
  }, [loadData]);

  const quarterlySnapshot = useMemo(() => {
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
    return [
      { q: "Q1", v: currentQuarter === 1 ? avgCompanyScore : 0 },
      { q: "Q2", v: currentQuarter === 2 ? avgCompanyScore : 0 },
      { q: "Q3", v: currentQuarter === 3 ? avgCompanyScore : 0 },
      { q: "Q4", v: currentQuarter === 4 ? avgCompanyScore : 0 },
    ];
  }, [avgCompanyScore]);

  const runRollupRefresh = async () => {
    if (!cycleId) {
      ToastService.error("No active cycle found.");
      return;
    }
    try {
      setRollupRefreshLoading(true);
      const res = await makeCall({
        method: "POST",
        route: apiRoutes.okr.dashboardRollupRefresh,
        body: { cycle_id: cycleId },
        isSecureRoute: true,
      });

      if (res.status >= 400) {
        throw new Error(res.data?.message || "Failed to refresh rollup");
      }

      ToastService.success(
        "Rollup refresh started. Dashboard will reload in a few seconds.",
      );
      // Give the background job ~8s to finish then reload dashboard data.
      setTimeout(() => {
        void loadData();
        setRollupRefreshLoading(false);
      }, 8000);
    } catch (e) {
      console.error("Rollup refresh error:", e);
      ToastService.error(okrErrorMessage(e));
      setRollupRefreshLoading(false);
    }
  };

  const generateSnapshots = async () => {
    if (!cycleId) {
      ToastService.error("No active cycle found.");
      return;
    }
    try {
      setSnapshotGeneratingLoading(true);
      const res = await makeCall({
        method: "POST",
        route: apiRoutes.okr.dashboardSnapshotsGenerate,
        body: { cycle_id: cycleId },
        isSecureRoute: true,
      });

      if (res.status >= 400) {
        throw new Error(res.data?.message || "Failed to generate snapshot");
      }

      ToastService.success(
        "Snapshot generation started. It will appear in Snapshot History shortly.",
      );
      // Poll for the new snapshot at 8s, 20s, and 40s — stops early if found.
      const pollCid = cycleId;
      const delays = [8000, 12000, 20000];
      let attempt = 0;
      const poll = async () => {
        attempt++;
        const count = await loadSnapshots(pollCid);
        if (count > 0 || attempt >= delays.length) {
          setSnapshotGeneratingLoading(false);
          if (attempt >= delays.length && count === 0) {
            ToastService.error(
              "Snapshot may still be processing — refresh the page in a moment.",
            );
          }
          return;
        }
        setTimeout(poll, delays[attempt]);
      };
      setTimeout(poll, delays[0]);
    } catch (e) {
      console.error("Snapshot generation error:", e);
      ToastService.error(okrErrorMessage(e));
      setSnapshotGeneratingLoading(false);
    }
  };

  if (!okrFeatureFlags.leadershipPages) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-slate-50 p-8 text-center text-gray-500 text-sm">
          Leadership dashboard disabled (feature flag).
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-6 space-y-8">
          <PageHeader>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4 text-white">
                <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner shrink-0">
                  <MdTrendingUp className="text-3xl" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tighter capitalize">
                    CEO Strategic Insights
                  </h1>
                  <p className="text-white/60 text-xs font-medium mt-1">
                    Real-time organizational performance rollup for the active
                    cycle
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <RefreshButton onClick={loadData} loading={loading} />
                <Button
                  variant="white"
                  size="sm"
                  onClick={runRollupRefresh}
                  disabled={!cycleId || loading || rollupRefreshLoading}
                  loading={rollupRefreshLoading}
                  className="tracking-widest font-space text-[10px] font-black"
                >
                  {rollupRefreshLoading ? "Refreshing..." : "Refresh Rollup"}
                </Button>
                <Button
                  variant="white"
                  size="sm"
                  onClick={generateSnapshots}
                  disabled={!cycleId || loading || snapshotGeneratingLoading}
                  loading={snapshotGeneratingLoading}
                  className="tracking-widest font-space text-[10px] font-black"
                >
                  {snapshotGeneratingLoading ? "Saving..." : "Save Snapshot"}
                </Button>
              </div>
            </div>
          </PageHeader>

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                label: "Company Objectives",
                value: totalCompanyObjectives,
                icon: MdTrackChanges,
                color: "text-primary",
                progress: null,
              },
              {
                label: "Company Key Results",
                value: totalCompanyKrs,
                icon: MdOutlineHub,
                color: "text-emerald-500",
                progress: null,
              },
              {
                label: "Strategic Progress",
                value: `${avgCompanyScore}%`,
                icon: MdTrendingUp,
                color: "text-blue-500",
                progress: avgCompanyScore,
              },
              {
                label: "Dept Objectives",
                value: totalDepartmentObjectives,
                icon: MdBusinessCenter,
                color: "text-amber-500",
                progress: null,
              },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/40 ring-1 ring-slate-100 transition-all hover:shadow-2xl hover:shadow-primary/10"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-black tracking-widest text-slate-400 font-space mb-1 uppercase">
                      {stat.label}
                    </p>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter capitalize">
                      {cycleId ? stat.value : "—"}
                    </h3>
                  </div>
                  <div
                    className={`p-3 rounded-2xl ${stat.color} bg-current/5 group-hover:bg-current/10 transition-colors`}
                  >
                    <stat.icon className="text-2xl" />
                  </div>
                </div>
                {stat.progress !== null && (
                  <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-1000 liquid-progress"
                      style={{ width: `${stat.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* Department Performance — Full Width */}
          <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                  <MdBusinessCenter className="text-xl" />
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tighter capitalize">
                  Department Performance
                </h2>
              </div>
              <span className="text-[10px] font-black text-primary bg-primary/5 px-3 py-1 rounded-full uppercase tracking-widest font-space">
                Live Rollup
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {loading ? (
                <LoadingSkeleton variant="table-row" count={4} />
              ) : departments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <MdWarningAmber className="text-4xl text-slate-300 mb-4" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest font-space">
                    No participating departments
                  </p>
                </div>
              ) : (
                departments.map((d) => (
                  <div
                    key={d.name}
                    className="group flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-100 hover:border-primary/30 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300"
                  >
                    <div className="flex flex-col gap-1.5">
                      <span className="text-base font-black text-slate-900 group-hover:text-primary transition-colors tracking-tight">
                        {d.name}
                      </span>
                      <div className="flex items-center gap-3 text-[9px] text-slate-400 font-black uppercase tracking-widest font-space">
                        <span className="flex items-center gap-1">
                          <MdTrackChanges className="text-xs" />{" "}
                          {d.objectiveCount}
                        </span>
                        <span className="text-slate-200">•</span>
                        <span className="flex items-center gap-1">
                          <MdOutlineHub className="text-xs" /> {d.krCount}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xl font-black text-slate-900 tracking-tighter">
                          {d.score}%
                        </div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-space">
                          Direct
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-slate-900 tracking-tighter">
                          {d.indirectScore ?? 0}%
                        </div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-space">
                          Indirect
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-slate-900 tracking-tighter">
                          {d.completion}%
                        </div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-space">
                          Done
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Strategic Health + At Risk — Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                  <MdBarChart className="text-xl" />
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tighter capitalize">
                  Strategic Health
                </h2>
              </div>
              <div className="space-y-6">
                {companyObjectives.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-space mb-2">
                      Completion Focus
                    </p>
                    <select
                      value={selectedCompletionObjectiveId ?? ""}
                      onChange={(e) =>
                        setSelectedCompletionObjectiveId(Number(e.target.value))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      {companyObjectives.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-3">
                  {quarterlySnapshot.map((x) => (
                    <div
                      key={x.q}
                      className="rounded-2xl border border-slate-50 bg-white p-3 text-center transition-all hover:border-blue-200"
                    >
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space mb-1">
                        {x.q}
                      </div>
                      <div className="text-sm font-black text-slate-900 tracking-tighter">
                        {x.v}%
                      </div>
                    </div>
                  ))}
                </div>
                <div className="group rounded-2xl bg-white p-5 border border-slate-100 shadow-sm transition-all hover:border-primary/20">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-space">
                      Completion Rate
                    </p>
                    <MdPieChart className="text-xl text-primary" />
                  </div>
                  <div className="text-4xl font-black tracking-tighter mb-4 text-slate-900">
                    {completionRate}%
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-1000"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  {completionStatus?.mandatoryKRs != null && (
                    <p className="text-[10px] font-medium text-slate-500 mt-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Mandatory: {completionStatus.mandatoryCompleted ?? 0}/
                      {completionStatus.mandatoryKRs} items
                      {completionStatus.isBlocked && (
                        <span className="text-red-500 font-bold ml-auto uppercase tracking-tighter">
                          Blocked
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                  <MdWarningAmber className="text-xl" />
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tighter capitalize">
                  At Risk Insights
                </h2>
              </div>
              <div className="space-y-3">
                {loading ? (
                  <LoadingSkeleton variant="text" count={3} />
                ) : atRiskRows.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center py-4">
                    All goals on track
                  </p>
                ) : (
                  atRiskRows.slice(0, 5).map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-amber-50/30 border border-amber-100/50"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="text-xs font-black text-slate-900 truncate tracking-tight">
                          {r.kr}
                        </p>
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest font-space mt-1">
                          {r.dept}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-amber-700">
                          {r.score}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Snapshot History — Full Width */}
          <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter capitalize">
                  Snapshot History
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Audit trail of company performance captures
                </p>
              </div>
              <MdHistory className="text-3xl text-slate-200" />
            </div>
            {recentSnapshots.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recentSnapshots.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (cycleId) navigate(`/admin/okr/archive`);
                    }}
                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30 hover:bg-white hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <MdCameraAlt className="text-xl" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 uppercase tracking-tighter">
                          {new Date(s.snapshot_date).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-space">
                          Score: {Number(s.score_value ?? 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <MdChevronRight className="text-slate-300 group-hover:text-primary transition-colors text-xl" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                  <MdHistory className="text-2xl text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 font-medium">
                  No snapshots available yet.
                </p>
                <p className="text-[10px] text-slate-300 uppercase tracking-widest mt-1">
                  Use 'Save Snapshot' to create one
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
