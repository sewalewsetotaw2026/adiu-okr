import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import InfoBanner from "../../../../components/common/InfoBanner";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import MetricStat from "../components/MetricStat";
import { okrFeatureFlags } from "../okrFeatureFlags";
import { routeConstants } from "../../../../../utils/constants";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import {
  okrAsArray,
  okrErrorMessage,
  okrUnwrap,
} from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import { MdWarningAmber, MdChevronRight } from "react-icons/md";

type DeptRow = {
  name: string;
  score: number;
  value: number;
  completion: number;
  risk: number;
  objectiveCount: number;
  krCount: number;
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
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [totalCompanyObjectives, setTotalCompanyObjectives] = useState(0);
  const [totalCompanyKrs, setTotalCompanyKrs] = useState(0);
  const [avgCompanyScore, setAvgCompanyScore] = useState(0);
  const [totalCompanyValue, setTotalCompanyValue] = useState(0);
  const [totalDepartmentObjectives, setTotalDepartmentObjectives] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [atRiskRows, setAtRiskRows] = useState<AtRiskRow[]>([]);
  const [financialCount, setFinancialCount] = useState(0);
  const [financialItems, setFinancialItems] = useState<
    Array<{ id: number; title: string; unit: string; target: string }>
  >([]);
  const [companyObjectives, setCompanyObjectives] = useState<
    CompanyObjectiveOption[]
  >([]);
  const [selectedCompletionObjectiveId, setSelectedCompletionObjectiveId] =
    useState<number | null>(null);
  const [completionStatus, setCompletionStatus] =
    useState<CompletionStatusRow | null>(null);

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
        return;
      }
      setCycleId(cid);

      const [ceoRes, deptRes, atRiskRes, finRes] = await Promise.all([
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
        makeCall({
          method: "GET",
          route: apiRoutes.okr.dashboardFinancial,
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
      setTotalCompanyValue(Number(summary.totalCompanyValue ?? 0) || 0);
      setTotalDepartmentObjectives(
        Number(summary.totalDepartmentObjectives ?? 0) || 0,
      );

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

      // Fallback completion rate from CEO summary; refined via /completion endpoint below.
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
          value: Number(d.totalValue ?? 0) || 0,
          completion: Number(d.completionRate ?? 0) || 0,
          risk: Number(d.completedKRs ?? 0) || 0,
          objectiveCount: Number(d.objectiveCount ?? 0) || 0,
          krCount: Number(d.krCount ?? 0) || 0,
        })),
      );

      const finBody = okrUnwrap<any>(finRes) ?? {};
      const fin = finBody.financial ?? {};
      setFinancialCount(Number(fin.count ?? 0) || 0);
      const finRows = okrAsArray<any>(fin.items ?? []);
      setFinancialItems(
        finRows.slice(0, 6).map((x) => ({
          id: Number(x.id),
          title: String(x.title ?? "KR"),
          unit: String(x.unit ?? ""),
          target: String(x.target ?? ""),
        })),
      );
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setDepartments([]);
      setAtRiskRows([]);
      setFinancialItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (!cycleId) return;
    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.dashboardRollupRefresh,
        body: { cycle_id: cycleId },
        isSecureRoute: true,
      });
      ToastService.success("Rollup refreshed.");
      await loadData();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  const generateSnapshots = async () => {
    if (!cycleId) return;
    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.dashboardSnapshotsGenerate,
        body: { cycle_id: cycleId },
        isSecureRoute: true,
      });
      ToastService.success("Snapshot generated.");
      await loadData();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-2 space-y-6">
          <nav className="flex flex-wrap items-center gap-2 text-sm pt-4">
            <button
              type="button"
              onClick={() => navigate(routeConstants.okr)}
              className="text-gray-500 hover:text-gray-800 transition-colors"
            >
              OKR
            </button>
            <MdChevronRight className="text-gray-300 shrink-0 text-lg" />
            <span className="text-gray-800 font-medium">
              Strategic Dashboard
            </span>
          </nav>

          <PageHeader>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Strategic Dashboard
              </h1>
              <p className="text-white/80 text-sm mt-1">
                Company rollup for the active OKR cycle.
              </p>
            </div>
          </PageHeader>

          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              to={routeConstants.okrDepartmentComparison}
              className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200 text-gray-700 hover:bg-slate-50"
            >
              Department comparison
            </Link>
            <Link
              to={routeConstants.okrCompanyGallery}
              className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200 text-gray-700 hover:bg-slate-50"
            >
              OKR gallery
            </Link>
            <Link
              to={routeConstants.okrDepartmentApprovalQueue}
              className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200 text-gray-700 hover:bg-slate-50 flex items-center gap-1"
            >
              Approvals
            </Link>
            <RefreshButton onClick={loadData} loading={loading} />
            <button
              type="button"
              onClick={runRollupRefresh}
              className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200 text-gray-700 hover:bg-slate-50"
              disabled={!cycleId || loading}
            >
              Refresh rollup
            </button>
            <button
              type="button"
              onClick={generateSnapshots}
              className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200 text-gray-700 hover:bg-slate-50"
              disabled={!cycleId || loading}
            >
              Generate snapshot
            </button>
          </div>

          <InfoBanner variant="info">
            <strong>Progress</strong> is based on current vs target value;{" "}
            <strong>value</strong> is business outcome.
          </InfoBanner>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover-premium">
              <MetricStat
                label="Company objectives"
                value={cycleId ? totalCompanyObjectives : "—"}
                loading={loading}
              />
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover-premium">
              <MetricStat
                label="Company KRs"
                value={cycleId ? totalCompanyKrs : "—"}
                loading={loading}
              />
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover-premium">
              <MetricStat
                label="Avg progress"
                value={cycleId ? `${avgCompanyScore}%` : "—"}
                progress={avgCompanyScore}
                loading={loading}
              />
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover-premium">
              <MetricStat
                label="Department objectives"
                value={cycleId ? totalDepartmentObjectives : "—"}
                loading={loading}
              />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-space">
                  Departments
                </h2>
                <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg uppercase tracking-tighter">
                  Live Tracking
                </span>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <LoadingSkeleton variant="table-row" count={4} />
                ) : departments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <MdWarningAmber className="text-3xl text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-400">
                      No departments participating in this cycle.
                    </p>
                  </div>
                ) : (
                  departments.map((d) => (
                    <div
                      key={d.name}
                      className="group flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-primary/20 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                          {d.name}
                        </span>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest font-space">
                          <span>{d.objectiveCount} Objectives</span>
                          <span className="text-slate-200">|</span>
                          <span>{d.krCount} Key Results</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">
                            {d.score}%
                          </div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                            Progress
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-full border-2 border-slate-100 flex items-center justify-center group-hover:border-primary/20 transition-colors">
                          <div className="text-[10px] font-black text-slate-800">
                            {d.completion}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4">
                Quarterly snapshot
              </h2>

              {companyObjectives.length > 0 ? (
                <label className="mb-3 block">
                  <span className="text-xs text-gray-500">
                    Completion focus objective
                  </span>
                  <select
                    value={
                      selectedCompletionObjectiveId != null
                        ? String(selectedCompletionObjectiveId)
                        : ""
                    }
                    onChange={(e) =>
                      setSelectedCompletionObjectiveId(Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                  >
                    {companyObjectives.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="grid grid-cols-4 gap-2">
                {quarterlySnapshot.map((x) => (
                  <div
                    key={x.q}
                    className="rounded-lg border border-gray-100 bg-slate-50 py-3 text-center text-sm"
                  >
                    <div className="text-gray-500 text-xs">{x.q}</div>
                    <div className="font-semibold text-gray-900">{x.v}%</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 ring-1 ring-gray-100 p-3">
                  <p className="text-xs text-gray-500">Completion</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {completionRate}%
                  </p>
                  {completionStatus?.mandatoryKRs != null ? (
                    <p className="text-xs text-gray-500 mt-1">
                      Mandatory {completionStatus.mandatoryCompleted ?? 0}/
                      {completionStatus.mandatoryKRs}
                      {completionStatus.isBlocked ? " (blocked)" : ""}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl bg-slate-50 ring-1 ring-gray-100 p-3">
                  <p className="text-xs text-gray-500">Total value</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {totalCompanyValue}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <section className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">At risk</h2>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-gray-700">
                      KR
                    </th>
                    <th className="px-3 py-2 font-semibold text-gray-700">
                      Dept
                    </th>
                    <th className="px-3 py-2 font-semibold text-gray-700">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-4 text-center text-gray-500"
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : atRiskRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-4 text-center text-gray-500"
                      >
                        No at-risk items.
                      </td>
                    </tr>
                  ) : (
                    atRiskRows.map((r) => (
                      <tr key={r.kr} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-900">{r.kr}</td>
                        <td className="px-3 py-2 text-gray-600">{r.dept}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-100 text-xs">
                            <MdWarningAmber className="text-sm" />
                            {r.score}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">
                Financial OKRs
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                {loading ? "Loading…" : `${financialCount} items`}
              </p>
              {financialItems.length === 0 ? (
                <p className="text-sm text-gray-500">No items.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {financialItems.map((x) => (
                    <div
                      key={x.id}
                      className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-gray-100"
                    >
                      <p className="font-medium text-gray-900">{x.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Target {x.target} {x.unit}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
