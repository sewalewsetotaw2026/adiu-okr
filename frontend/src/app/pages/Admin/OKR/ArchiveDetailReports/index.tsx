import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
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
  MdAssessment,
  MdAutoGraph,
  MdCloudDownload,
  MdRefresh,
  MdPlayArrow,
  MdChevronLeft,
  MdArchive,
  MdBarChart,
  MdLightbulb,
  MdFileDownload,
  MdCheck,
  MdSchedule,
  MdError,
  MdTrendingUp,
  MdGroups,
  MdCalendarToday,
} from "react-icons/md";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import Button from "../../../../components/Core/ui/Button";

type ExportFormat = "PDF" | "CSV" | "XLSX" | "JSON";

const REPORT_TYPES = [
  { key: "company_summary", label: "Company Summary" },
  { key: "department_performance", label: "Department Performance" },
  { key: "contributor_performance", label: "Contributor Performance" },
  { key: "blocker_summary", label: "Blocker Summary" },
] as const;

const INSIGHT_TYPES = [
  { key: "top_performers", label: "Top Performers", icon: MdTrendingUp, color: "text-emerald-600 bg-emerald-50" },
  { key: "bottlenecks", label: "Bottlenecks", icon: MdError, color: "text-rose-600 bg-rose-50" },
  { key: "completion_rate", label: "Completion Rate", icon: MdBarChart, color: "text-primary-600 bg-primary-50" },
  { key: "blocker_summaries", label: "Blocker Summaries", icon: MdSchedule, color: "text-amber-600 bg-amber-50" },
  { key: "alignment_coverage", label: "Alignment Coverage", icon: MdGroups, color: "text-violet-600 bg-violet-50" },
  { key: "cadence_adherence", label: "Cadence Adherence", icon: MdCalendarToday, color: "text-sky-600 bg-sky-50" },
] as const;

type TabKey = "overview" | "reports" | "insights" | "exports";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusPill({ status }: { status: unknown }) {
  const s = String(status ?? "").toUpperCase();
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    COMPLETED: { cls: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <MdCheck size={11} />, label: "Completed" },
    PENDING:   { cls: "text-amber-700 bg-amber-50 border-amber-200",      icon: <MdSchedule size={11} />, label: "Pending" },
    PROCESSING:{ cls: "text-sky-700 bg-sky-50 border-sky-200",            icon: <MdRefresh size={11} className="animate-spin" />, label: "Processing" },
    FAILED:    { cls: "text-rose-700 bg-rose-50 border-rose-200",         icon: <MdError size={11} />, label: "Failed" },
    EXPIRED:   { cls: "text-slate-500 bg-slate-50 border-slate-200",      icon: <MdSchedule size={11} />, label: "Expired" },
  };
  const style = map[s] ?? { cls: "text-slate-500 bg-slate-50 border-slate-200", icon: null, label: s || "Unknown" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border ${style.cls}`}>
      {style.icon}{style.label}
    </span>
  );
}

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        strokeWidth={8} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        className="text-primary transition-all duration-1000" />
    </svg>
  );
}

export default function ArchiveDetailReportsPage() {
  const { archiveId } = useParams<{ archiveId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [archive, setArchive] = useState<Record<string, unknown> | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportType, setExportType] = useState("full_quarter");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("PDF");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const load = useCallback(async () => {
    if (!archiveId) return;
    setLoading(true);
    try {
      const res = await makeCall({ method: "GET", route: apiRoutes.okr.archiveById(archiveId), isSecureRoute: true });
      setArchive((okrUnwrap(res) as Record<string, unknown>) ?? null);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setArchive(null);
    } finally {
      setLoading(false);
    }
  }, [archiveId]);

  useEffect(() => { if (!okrFeatureFlags.archive) return; void load(); }, [load]);

  const reports    = okrAsArray<any>(archive?.reports);
  const insights   = okrAsArray<any>(archive?.insights);
  const exportJobs = okrAsArray<any>(archive?.exportJobs);
  const snapshots  = okrAsArray<any>(archive?.snapshots);
  const latestSnapshot = snapshots[snapshots.length - 1] ?? null;

  const scoreNum = latestSnapshot?.score_value != null ? Number(latestSnapshot.score_value) : null;
  const aggregateScore  = scoreNum != null ? scoreNum.toFixed(1) : "—";
  const unlockedValue   = latestSnapshot?.objective_value != null ? String(latestSnapshot.objective_value) : "—";
  const completionRate  = latestSnapshot?.completion_rate != null ? `${Number(latestSnapshot.completion_rate).toFixed(1)}%` : "—";
  const totalObjectives = latestSnapshot?.total_objectives ?? 0;
  const totalKRs        = latestSnapshot?.total_key_results ?? 0;

  const quarterTitle = useMemo(() => {
    const q = String(archive?.quarter_name ?? "").trim();
    if (q) return q;
    const cycle = archive?.cycle as Record<string, unknown> | undefined;
    return String(cycle?.quarter_label ?? cycle?.name ?? "Archive");
  }, [archive]);

  const runReport = useCallback(async (reportType: string) => {
    if (!archiveId) return;
    setBusyAction(`report:${reportType}`);
    try {
      await makeCall({ method: "POST", route: apiRoutes.okr.archiveReports(archiveId), body: { report_type: reportType }, isSecureRoute: true });
      ToastService.success("Report generated.");
      await load();
    } catch (e) { ToastService.error(okrErrorMessage(e)); }
    finally { setBusyAction(null); }
  }, [archiveId, load]);

  const runInsight = useCallback(async (insightType: string) => {
    if (!archiveId) return;
    setBusyAction(`insight:${insightType}`);
    try {
      await makeCall({ method: "POST", route: apiRoutes.okr.archiveInsights(archiveId), body: { insight_type: insightType }, isSecureRoute: true });
      ToastService.success("Insight generated.");
      await load();
    } catch (e) { ToastService.error(okrErrorMessage(e)); }
    finally { setBusyAction(null); }
  }, [archiveId, load]);

  const runExport = useCallback(async () => {
    if (!archiveId) return;
    setBusyAction("export:create");
    try {
      await makeCall({ method: "POST", route: apiRoutes.okr.archiveExports(archiveId), body: { export_type: exportType, format: exportFormat }, isSecureRoute: true });
      ToastService.success("Export job created.");
      await load();
    } catch (e) { ToastService.error(okrErrorMessage(e)); }
    finally { setBusyAction(null); }
  }, [archiveId, exportType, exportFormat, load]);

  const refreshExportJob = useCallback(async (jobId: number) => {
    setBusyAction(`job:${jobId}`);
    try {
      await makeCall({ method: "GET", route: apiRoutes.okr.exportJobById(jobId), isSecureRoute: true });
      await load();
    } catch (e) { ToastService.error(okrErrorMessage(e)); }
    finally { setBusyAction(null); }
  }, [load]);

  if (!okrFeatureFlags.archive) return (
    <AdminLayout><div className="min-h-screen bg-slate-50 p-8 text-center text-slate-400 text-sm">Archive disabled.</div></AdminLayout>
  );
  if (!archiveId) return (
    <AdminLayout><div className="min-h-screen bg-slate-50 p-8 text-center text-slate-400 text-sm">Missing archive id.</div></AdminLayout>
  );

  const TABS: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "overview", label: "Overview",  icon: <MdBarChart size={16} /> },
    { key: "reports",  label: "Reports",   icon: <MdAssessment size={16} />, count: reports.length },
    { key: "insights", label: "Insights",  icon: <MdLightbulb size={16} />, count: insights.length },
    { key: "exports",  label: "Exports",   icon: <MdFileDownload size={16} />, count: exportJobs.length },
  ];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        {/* ── Header ── */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-0">
            {/* Back link */}
            <button
              onClick={() => navigate(routeConstants.okrArchiveManagement)}
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-bold uppercase tracking-widest mb-5 transition-colors"
            >
              <MdChevronLeft size={16} /> Archive Management
            </button>

            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 pb-6">
              {/* Left: Title */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <MdArchive size={24} className="text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Archived
                    </span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      {formatDate(String(archive?.archived_at ?? ""))}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tighter leading-none text-slate-900">
                    {loading ? "Loading…" : quarterTitle}
                  </h1>
                  {!loading && archive && (
                    <p className="text-slate-500 text-sm mt-1">
                      {String((archive?.cycle as any)?.name ?? "")}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Score ring */}
              {!loading && scoreNum != null && (
                <div className="flex items-center gap-5 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4">
                  <div className="relative flex items-center justify-center">
                    <ScoreRing score={scoreNum} size={76} />
                    <span className="absolute text-lg font-black tracking-tighter text-slate-900">{scoreNum.toFixed(0)}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Aggregate Score</p>
                    <p className="text-2xl font-black tracking-tighter text-slate-900">{aggregateScore}</p>
                    <p className="text-xs text-slate-400 mt-1">{completionRate} completed</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats row */}
            {!loading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-6">
                {[
                  { label: "Objectives", value: totalObjectives },
                  { label: "Key Results", value: totalKRs },
                  { label: "Reports", value: reports.length },
                  { label: "Exports", value: exportJobs.length },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                    <p className="text-2xl font-black tracking-tighter text-slate-900 mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tab bar */}
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 -mb-px ${
                    activeTab === t.key
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {t.icon}
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                      activeTab === t.key ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                    }`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1,2,3].map(i => <LoadingSkeleton key={i} className="h-36 rounded-3xl" />)}
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {[
                      { label: "Aggregate Score", value: aggregateScore, sub: "Company-wide average", accent: "text-primary" },
                      { label: "Value Unlocked", value: unlockedValue, sub: "Key result outcomes", accent: "text-slate-900" },
                      { label: "Completion Rate", value: completionRate, sub: "Across all objectives", accent: "text-emerald-600" },
                    ].map((c) => (
                      <div key={c.label} className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-7 hover:shadow-2xl hover:shadow-slate-200/60 hover:-translate-y-0.5 transition-all">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{c.label}</p>
                        <p className={`text-5xl font-black tracking-tighter ${c.accent}`}>{c.value}</p>
                        <p className="text-xs text-slate-400 mt-2">{c.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Snapshot history timeline */}
                  {snapshots.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-7">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
                        <MdBarChart className="text-primary" size={18} /> Score Timeline
                      </h3>
                      <div className="space-y-3">
                        {snapshots.map((s: any, i: number) => {
                          const pct = Math.min(100, Math.max(0, Number(s.score_value ?? 0)));
                          return (
                            <div key={s.id ?? i} className="flex items-center gap-4 group">
                              <span className="text-xs text-slate-400 font-bold w-24 flex-shrink-0">
                                {formatDate(s.snapshot_date)}
                              </span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs font-black text-slate-700 w-12 text-right">{pct.toFixed(1)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quick action cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: "Generate Reports", desc: "Produce company, dept & contributor reports", tab: "reports" as TabKey, icon: <MdAssessment size={20} />, color: "bg-primary/10 text-primary" },
                      { label: "Run Insights",     desc: "Extract strategic insights from this archive", tab: "insights" as TabKey, icon: <MdLightbulb size={20} />, color: "bg-amber-50 text-amber-600" },
                      { label: "Export Data",       desc: "Download as PDF, CSV or XLSX", tab: "exports" as TabKey, icon: <MdFileDownload size={20} />, color: "bg-emerald-50 text-emerald-600" },
                    ].map((a) => (
                      <button
                        key={a.label}
                        onClick={() => setActiveTab(a.tab)}
                        className="text-left group bg-white rounded-2xl border border-slate-100 p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5 transition-all"
                      >
                        <div className={`inline-flex p-2.5 rounded-xl ${a.color} mb-3`}>{a.icon}</div>
                        <p className="text-sm font-black text-slate-900">{a.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* REPORTS TAB */}
              {activeTab === "reports" && (
                <div className="space-y-6">
                  {/* Generate buttons */}
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <MdAssessment className="text-primary" size={18} /> Generate a Report
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {REPORT_TYPES.map((r) => (
                        <button
                          key={r.key}
                          disabled={busyAction !== null}
                          onClick={() => void runReport(r.key)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-700 uppercase tracking-widest hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50"
                        >
                          {busyAction === `report:${r.key}` ? (
                            <MdRefresh size={14} className="animate-spin" />
                          ) : (
                            <MdPlayArrow size={14} />
                          )}
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reports list */}
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Generated Reports</h3>
                    </div>
                    {reports.length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <MdAssessment size={24} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-400">No reports generated yet.</p>
                        <p className="text-xs text-slate-300 mt-1">Use the buttons above to generate your first report.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {reports.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                            <div>
                              <p className="text-sm font-bold text-slate-900">{r.report_name ?? `Report #${r.id}`}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{String(r.report_type ?? "").replace(/_/g, " ")}</p>
                            </div>
                            <span className="text-xs text-slate-400">{formatDateTime(r.generated_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* INSIGHTS TAB */}
              {activeTab === "insights" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {INSIGHT_TYPES.map((it) => {
                    const ins = insights.find((i: any) => i.insight_type === it.key);
                    const Icon = it.icon;
                    return (
                      <div key={it.key} className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 flex flex-col hover:shadow-2xl hover:shadow-slate-200/60 hover:-translate-y-0.5 transition-all">
                        <div className={`inline-flex p-3 rounded-2xl ${it.color} mb-4 self-start`}>
                          <Icon size={20} />
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mb-1">{it.label}</h4>
                        <p className="text-xs text-slate-400 flex-1">
                          {ins ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <MdCheck size={12} /> Last run {formatDate(ins.updated_at)}
                            </span>
                          ) : (
                            "No data generated yet"
                          )}
                        </p>
                        <button
                          disabled={busyAction !== null}
                          onClick={() => void runInsight(it.key)}
                          className="mt-4 flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-600 uppercase tracking-widest hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50"
                        >
                          {busyAction === `insight:${it.key}` ? (
                            <MdRefresh size={13} className="animate-spin" />
                          ) : (
                            <MdPlayArrow size={13} />
                          )}
                          {ins ? "Re-run" : "Generate"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* EXPORTS TAB */}
              {activeTab === "exports" && (
                <div className="space-y-6">
                  {/* Export builder */}
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-7">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
                      <MdAutoGraph className="text-primary" size={18} /> Create Export
                    </h3>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="flex-1 min-w-44">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Export Type</label>
                        <select
                          value={exportType}
                          onChange={(e) => setExportType(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-primary transition-all"
                        >
                          <option value="full_quarter">Full Quarter</option>
                          <option value="report_pack">Report Pack</option>
                          <option value="department">Department</option>
                          <option value="objective">Objective</option>
                          <option value="contributor">Contributor</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Format</label>
                        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                          {(["PDF", "CSV", "XLSX"] as ExportFormat[]).map((fmt) => (
                            <button
                              key={fmt}
                              onClick={() => setExportFormat(fmt)}
                              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                exportFormat === fmt
                                  ? "bg-white shadow text-slate-900 border border-slate-200"
                                  : "text-slate-400 hover:text-slate-600"
                              }`}
                            >
                              {fmt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        disabled={busyAction !== null}
                        onClick={runExport}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all disabled:opacity-50 shadow-lg shadow-slate-900/20"
                      >
                        {busyAction === "export:create" ? (
                          <MdRefresh size={14} className="animate-spin" />
                        ) : (
                          <MdAutoGraph size={14} />
                        )}
                        Start Export
                      </button>
                    </div>
                  </div>

                  {/* Export jobs */}
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Export Jobs</h3>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exportJobs.length} jobs</span>
                    </div>
                    {exportJobs.length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <MdCloudDownload size={24} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-400">No export jobs yet.</p>
                        <p className="text-xs text-slate-300 mt-1">Configure and start your first export above.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {exportJobs.map((job: any) => (
                          <div key={job.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <MdFileDownload size={18} className="text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 capitalize">{String(job.export_type ?? "").replace(/_/g, " ")}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(job.created_at)}</p>
                            </div>
                            <span className="text-[10px] font-black text-slate-600 uppercase bg-slate-100 px-2 py-1 rounded-lg tracking-widest">{job.format}</span>
                            <StatusPill status={job.status} />
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => void refreshExportJob(Number(job.id))}
                                disabled={busyAction !== null}
                                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-primary hover:border-primary transition-all"
                                title="Refresh status"
                              >
                                {busyAction === `job:${job.id}` ? (
                                  <MdRefresh size={15} className="animate-spin" />
                                ) : (
                                  <MdRefresh size={15} />
                                )}
                              </button>
                              {okrAsArray(job.files).length > 0 && (
                                <a
                                  href={(okrAsArray<any>(job.files)[0]).download_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
                                >
                                  <MdCloudDownload size={13} /> Download
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
