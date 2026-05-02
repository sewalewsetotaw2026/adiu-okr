import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import { routeConstants } from "../../../../../utils/constants";
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
  MdArrowBack,
  MdAssessment,
  MdAutoGraph,
  MdCloudDownload,
  MdRefresh,
  MdPlayArrow,
} from "react-icons/md";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import RefreshButton from "../../../../components/common/RefreshButton";

type ExportFormat = "PDF" | "CSV" | "XLSX" | "JSON";

const REPORT_TYPES = [
  { key: "company_summary", label: "Company Summary" },
  { key: "department_performance", label: "Department Performance" },
  { key: "contributor_performance", label: "Contributor Performance" },
] as const;

const INSIGHT_TYPES = [
  { key: "top_performers", label: "Top Performers" },
  { key: "bottlenecks", label: "Bottlenecks" },
  { key: "completion_rate", label: "Completion Rate" },
  { key: "blocker_summaries", label: "Blocker Summaries" },
  { key: "alignment_coverage", label: "Alignment Coverage" },
  { key: "cadence_adherence", label: "Cadence Adherence" },
] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function statusPill(statusRaw: unknown) {
  const s = String(statusRaw ?? "").toUpperCase();
  const map: Record<string, { bg: string, text: string, border: string, label: string }> = {
    COMPLETED: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", label: "Completed" },
    PENDING: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", label: "Pending" },
    PROCESSING: { bg: "bg-sky-50", text: "text-sky-600", border: "border-sky-100", label: "Processing" },
    FAILED: { bg: "bg-red-50", text: "text-red-600", border: "border-red-100", label: "Failed" },
    EXPIRED: { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-100", label: "Expired" },
  };

  const style = map[s] ?? { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-100", label: s || "UNKNOWN" };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border font-space ${style.bg} ${style.text} ${style.border}`}
    >
      <span className={`w-1 h-1 rounded-full ${(s === 'PENDING' || s === 'PROCESSING') ? 'animate-pulse' : ''} bg-current`} />
      {style.label}
    </span>
  );
}

export default function ArchiveDetailReportsPage() {
  const { archiveId } = useParams<{ archiveId: string }>();
  const [loading, setLoading] = useState(true);
  const [archive, setArchive] = useState<Record<string, unknown> | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportType, setExportType] = useState("full_quarter");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("PDF");

  const load = useCallback(async () => {
    if (!archiveId) return;
    setLoading(true);
    try {
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.archiveById(archiveId),
        isSecureRoute: true,
      });
      const data = okrUnwrap(res);
      setArchive((data as Record<string, unknown>) ?? null);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setArchive(null);
    } finally {
      setLoading(false);
    }
  }, [archiveId]);

  useEffect(() => {
    if (!okrFeatureFlags.archive) return;
    void load();
  }, [load]);

  const reports = okrAsArray<any>(archive?.reports);
  const insights = okrAsArray<any>(archive?.insights);
  const exportJobs = okrAsArray<any>(archive?.exportJobs);
  const snapshots = okrAsArray<any>(archive?.snapshots);
  const latestSnapshot = snapshots[0] ?? null;

  const aggregateScore =
    latestSnapshot?.score_value != null
      ? String(latestSnapshot.score_value)
      : "-";
  const unlockedValue =
    latestSnapshot?.objective_value != null
      ? String(latestSnapshot.objective_value)
      : "-";
  const completionRate =
    latestSnapshot?.completion_rate != null
      ? `${latestSnapshot.completion_rate}%`
      : "-";

  const runReport = useCallback(
    async (reportType: string) => {
      if (!archiveId) return;
      setBusyAction(`report:${reportType}`);
      try {
        await makeCall({
          method: "POST",
          route: apiRoutes.okr.archiveReports(archiveId),
          body: { report_type: reportType },
          isSecureRoute: true,
        });
        ToastService.success("Report generated.");
        await load();
      } catch (e) {
        ToastService.error(okrErrorMessage(e));
      } finally {
        setBusyAction(null);
      }
    },
    [archiveId, load],
  );

  const runInsight = useCallback(
    async (insightType: string) => {
      if (!archiveId) return;
      setBusyAction(`insight:${insightType}`);
      try {
        await makeCall({
          method: "POST",
          route: apiRoutes.okr.archiveInsights(archiveId),
          body: { insight_type: insightType },
          isSecureRoute: true,
        });
        ToastService.success("Insight generated.");
        await load();
      } catch (e) {
        ToastService.error(okrErrorMessage(e));
      } finally {
        setBusyAction(null);
      }
    },
    [archiveId, load],
  );

  const runExport = useCallback(async () => {
    if (!archiveId) return;
    setBusyAction("export:create");
    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.archiveExports(archiveId),
        body: {
          export_type: exportType,
          format: exportFormat,
        },
        isSecureRoute: true,
      });
      ToastService.success("Export job created.");
      await load();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  }, [archiveId, exportType, exportFormat, load]);

  const refreshExportJob = useCallback(
    async (jobId: number) => {
      setBusyAction(`job:${jobId}`);
      try {
        await makeCall({
          method: "GET",
          route: apiRoutes.okr.exportJobById(jobId),
          isSecureRoute: true,
        });
        await load();
      } catch (e) {
        ToastService.error(okrErrorMessage(e));
      } finally {
        setBusyAction(null);
      }
    },
    [load],
  );

  const quarterTitle = useMemo(() => {
    const q = String(archive?.quarter_name ?? "").trim();
    if (q) return q;
    const cycle = archive?.cycle as Record<string, unknown> | undefined;
    return String(cycle?.quarter_label ?? cycle?.name ?? "Archive");
  }, [archive]);

  if (!okrFeatureFlags.archive) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-slate-50 p-8 text-center text-gray-500 text-sm">
          Archive disabled (feature flag).
        </div>
      </AdminLayout>
    );
  }

  if (!archiveId) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-slate-50 p-8 text-center text-gray-500 text-sm">
          Missing archive id.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-2 space-y-6">
          <PageHeader>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <Link
                  to={routeConstants.okrArchiveManagement}
                  className="inline-flex items-center gap-1.5 text-white/70 text-[10px] font-black uppercase tracking-widest font-space hover:text-white transition-colors"
                >
                  <MdArrowBack className="text-sm" /> Back to Archives
                </Link>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tighter mt-3 uppercase">
                  {quarterTitle}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded border border-white/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-black text-white/90 uppercase tracking-widest font-space">Archived</span>
                  </div>
                  <span className="text-white/50 text-[10px] font-black uppercase tracking-widest font-space">
                    {formatDate(String(archive?.archived_at ?? ""))}
                  </span>
                </div>
              </div>
              <RefreshButton 
                onClick={load} 
                loading={loading} 
                className="bg-white/10 ring-white/20 text-white hover:bg-white/20 shadow-xl shadow-black/10" 
              />
            </div>
          </PageHeader>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <LoadingSkeleton className="h-32 rounded-3xl" />
              <LoadingSkeleton className="h-32 rounded-3xl" />
              <LoadingSkeleton className="h-32 rounded-3xl" />
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40 hover:border-primary/20 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space mb-1">Aggregate Score</p>
                  <p className="text-4xl font-black text-primary tracking-tighter group-hover:scale-105 transition-transform origin-left">
                    {aggregateScore}
                  </p>
                </div>
                <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40 hover:border-primary/20 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space mb-1">Key Value Unlocked</p>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">
                    {unlockedValue}
                  </p>
                </div>
                <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40 hover:border-primary/20 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space mb-1">Overall Completion</p>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">
                    {completionRate}
                  </p>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest font-space flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <MdAssessment className="text-lg" />
                    </div>
                    Reports
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {REPORT_TYPES.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => void runReport(r.key)}
                        className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-widest font-space text-slate-600 hover:border-primary hover:text-primary transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {busyAction === `report:${r.key}` ? (
                          <div className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                        ) : (
                          <MdPlayArrow className="text-sm" />
                        )}
                        {busyAction === `report:${r.key}` ? "Generating..." : r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm text-left">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">Report Name</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">Type</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">Generated Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reports.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center">
                            <p className="text-slate-400 font-medium">No Reports Generated Yet.</p>
                          </td>
                        </tr>
                      ) : (
                        reports.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">{r.report_name ?? `Report #${r.id}`}</td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space bg-slate-50 border border-slate-100 px-2 py-1 rounded">
                                {r.report_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-medium">{formatDateTime(r.generated_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest font-space flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                      <MdAutoGraph className="text-lg" />
                    </div>
                    Insights
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {INSIGHT_TYPES.map((i) => (
                      <button
                        key={i.key}
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => void runInsight(i.key)}
                        className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-widest font-space text-slate-600 hover:border-amber-500 hover:text-amber-600 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {busyAction === `insight:${i.key}` ? (
                          <div className="w-3 h-3 rounded-full border-2 border-amber-600/30 border-t-amber-600 animate-spin" />
                        ) : (
                          <MdPlayArrow className="text-sm" />
                        )}
                        {busyAction === `insight:${i.key}` ? "Analyzing..." : i.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      No Insights Generated Yet.
                    </div>
                  ) : (
                    insights.map((insight) => (
                      <div
                        key={insight.id}
                        className="group rounded-2xl bg-slate-50 border border-slate-100 p-4 hover:border-amber-200 transition-all"
                      >
                        <p className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                          {insight.insight_title ?? `Insight #${insight.id}`}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
                            {insight.insight_type}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
                            {formatDateTime(insight.generated_at)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest font-space flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-900 text-white">
                      <MdCloudDownload className="text-lg" />
                    </div>
                    Export Jobs
                  </h2>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={exportType}
                      onChange={(e) => setExportType(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest font-space text-slate-600 focus:ring-primary focus:border-primary outline-none transition-all"
                    >
                      <option value="full_quarter">Full Quarter</option>
                      <option value="report_pack">Report Pack</option>
                      <option value="department">Department</option>
                      <option value="objective">Objective</option>
                      <option value="contributor">Contributor</option>
                    </select>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                      {(["PDF", "CSV", "XLSX"] as ExportFormat[]).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setExportFormat(fmt)}
                          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest font-space rounded-lg transition-all ${
                            exportFormat === fmt
                              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                              : "text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={runExport}
                      className="rounded-xl bg-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest font-space text-white hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {busyAction === "export:create" ? (
                        <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : (
                        <MdAutoGraph className="text-sm" />
                      )}
                      {busyAction === "export:create" ? "Processing..." : "Start Export"}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm text-left">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">Job Type</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">Format</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {exportJobs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center">
                            <p className="text-slate-400 font-medium">No Export Jobs Requested Yet.</p>
                          </td>
                        </tr>
                      ) : (
                        exportJobs.map((job) => (
                          <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-900 block capitalize">
                                {job.export_type?.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space mt-0.5 block">
                                {formatDateTime(job.created_at)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest font-space bg-slate-100 px-2 py-1 rounded">
                                {job.format}
                              </span>
                            </td>
                            <td className="px-6 py-4">{statusPill(job.status)}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void refreshExportJob(Number(job.id))}
                                  disabled={busyAction !== null}
                                  className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-primary transition-all disabled:opacity-50"
                                  title="Refresh Status"
                                >
                                  <MdRefresh className={`text-lg ${busyAction === `job:${job.id}` ? 'animate-spin' : ''}`} />
                                </button>
                                {job.files && okrAsArray(job.files).length > 0 && (
                                  <a
                                    href={okrAsArray<any>(job.files)[0].download_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black uppercase tracking-widest font-space hover:bg-emerald-100 transition-all"
                                  >
                                    <MdCloudDownload className="text-sm" /> Download
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
