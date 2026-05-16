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
  MdExpandMore,
  MdCorporateFare,
} from "react-icons/md";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import InsightRenderer from "./InsightRenderer";
import { openExportDownload, extractExportDownloadUrl } from "../utils/exportDownloads";


type ExportFormat = "PDF" | "CSV" | "XLSX" | "JSON";


const INSIGHT_TYPES = [
  { key: "top_performers", label: "Top Performers (Individual)", icon: MdTrendingUp, color: "text-emerald-600 bg-emerald-50" },
  { key: "top_performers_team", label: "Top Performers (Team)", icon: MdGroups, color: "text-indigo-600 bg-indigo-50" },
  { key: "top_performers_department", label: "Top Performers (Department)", icon: MdCorporateFare, color: "text-violet-600 bg-violet-50" },
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
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

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
  const exportJobs = okrAsArray<any>(archive?.export_jobs ?? archive?.exportJobs);
  // snapshots are returned ordered ASC — last element is the most recent
  const snapshots  = okrAsArray<any>(archive?.snapshots);

  const latestSnapshot = snapshots[snapshots.length - 1] ?? null;
  const scoreNum = (() => {
    // Prefer snapshot value, then live computed score from backend fallback
    const snapVal = latestSnapshot?.score_value ?? latestSnapshot?.avg_score;
    const snapNum = snapVal != null ? Number(snapVal) : null;
    if (snapNum != null && snapNum > 0) return snapNum;
    const live = archive?.live_score;
    if (live != null) return Number(live);
    const fallback = archive?.aggregate_score ?? archive?.avg_score ?? archive?.score;
    return fallback != null ? Number(fallback) : null;
  })();

  const lastUpdated = useMemo(() => {
    const dates = [
      archive?.updated_at,
      archive?.created_at,
      ...reports.map(r => r.generated_at || r.updated_at || r.created_at),
      ...insights.map(i => i.generated_at || i.updated_at || i.created_at)
    ].filter(Boolean).map(d => new Date(d as string).getTime());
    return dates.length > 0 ? new Date(Math.max(...dates)) : null;
  }, [archive, reports, insights]);

  const aggregateScore = scoreNum != null ? scoreNum.toFixed(1) : "—";
  const unlockedValue = (() => {
    // Prefer live-computed sum from backend, then snapshot objective_value
    const raw =
      archive?.live_value_unlocked ??
      latestSnapshot?.objective_value ??
      latestSnapshot?.unlocked_value ??
      archive?.objective_value ??
      archive?.unlocked_value;
    const num = raw != null ? Number(raw) : null;
    if (num == null) return "—";
    if (num === 0) return "0";
    // Format as compact number (e.g. 1,250,000 → "1.25M") for large values
    if (Math.abs(num) >= 1_000_000)
      return `${(num / 1_000_000).toFixed(2)}M`;
    if (Math.abs(num) >= 1_000)
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num);
    return num.toFixed(2);
  })();
  const completionRate = (() => {
    // Prefer snapshot, then live computed completion from backend fallback
    const snapVal = latestSnapshot?.completion_rate ?? latestSnapshot?.progress_percent;
    const snapNum = snapVal != null ? Number(snapVal) : null;
    if (snapNum != null && snapNum > 0) return `${snapNum.toFixed(1)}%`;
    const live = archive?.live_completion_rate;
    if (live != null) return `${Number(live).toFixed(1)}%`;
    const fallback = archive?.completion_rate;
    return fallback != null ? `${Number(fallback).toFixed(1)}%` : "—";
  })();
  const totalObjectives = Number(
    archive?.live_objectives_count ??
    latestSnapshot?.total_objectives ??
    archive?.total_objectives ??
    0,
  );
  const totalKRs = Number(
    archive?.live_key_results_count ??
    latestSnapshot?.total_key_results ??
    archive?.total_key_results ??
    0,
  );

  const quarterTitle = useMemo(() => {
    const q = String(archive?.quarter_name ?? "").trim();
    if (q) return q;
    const cycle = archive?.cycle as Record<string, unknown> | undefined;
    return String(cycle?.quarter_label ?? cycle?.name ?? "Archive");
  }, [archive]);


  const runInsight = useCallback(async (insightType: string) => {
    if (!archiveId) return;
    setBusyAction(`insight:${insightType}`);
    try {
      await makeCall({ method: "POST", route: apiRoutes.okr.archiveInsights(archiveId), body: { insight_type: insightType }, isSecureRoute: true });
      ToastService.success("Insight generated — expanding below.");
      await load();
      setExpandedInsight(insightType);
    } catch (e) { ToastService.error(okrErrorMessage(e)); }
    finally { setBusyAction(null); }
  }, [archiveId, load]);

  const runExport = useCallback(async () => {
    if (!archiveId) return;
    setBusyAction("export:create");
    try {
      const res = await makeCall({ method: "POST", route: apiRoutes.okr.archiveExports(archiveId), body: { export_type: exportType, format: exportFormat }, isSecureRoute: true });
      const payload = okrUnwrap(res) as any;
      let opened = openExportDownload(payload);
      if (!opened) {
        const jobId = Number(payload?.job?.id ?? payload?.id);
        if (Number.isFinite(jobId) && jobId > 0) {
          try {
            const jobRes = await makeCall({ method: "GET", route: apiRoutes.okr.exportJobById(jobId), isSecureRoute: true });
            opened = openExportDownload(okrUnwrap(jobRes));
          } catch { opened = false; }
        }
      }
      if (opened) {
        ToastService.success("Export ready — downloading.");
      } else {
        ToastService.success("Export job created — check Exports tab when file is ready.");
        setActiveTab("exports");
      }
      await load();
    } catch (e) { ToastService.error(okrErrorMessage(e)); }
    finally { setBusyAction(null); }
  }, [archiveId, exportType, exportFormat, load]);

  const refreshExportJob = useCallback(async (jobId: number) => {
    setBusyAction(`job:${jobId}`);
    try {
      const res = await makeCall({ method: "GET", route: apiRoutes.okr.exportJobById(jobId), isSecureRoute: true });
      const payload = okrUnwrap(res) as any;
      const opened = openExportDownload(payload);
      if (opened) {
        ToastService.success("Downloading export.");
      } else {
        ToastService.info("Export not yet ready — try again shortly.");
      }
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

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview",  icon: <MdBarChart size={16} /> },
    { key: "insights", label: "Reports & Insights",  icon: <MdLightbulb size={16} /> },
    { key: "exports",  label: "Exports",   icon: <MdFileDownload size={16} /> },
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
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
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
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-slate-500 text-sm">
                        {String((archive?.cycle as any)?.name ?? "")}
                      </p>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium bg-slate-100/50 px-2 py-0.5 rounded-lg border border-slate-200/50">
                        <MdRefresh size={12} className={busyAction ? "animate-spin text-primary" : ""} />
                        Last updated: {formatDateTime(String(lastUpdated ?? archive?.updated_at ?? archive?.created_at ?? ""))}
                      </div>
                    </div>
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
                      : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
                  }`}
                >
                  {t.icon}
                  {t.label}
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
                        <p className={`text-5xl font-black tracking-tighter ${c.accent}`}>
                          {c.value}
                          {c.label === "Value Unlocked" && <span className="text-xl ml-2 opacity-30 font-medium tracking-normal">ETB</span>}
                        </p>
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
                              <span className="text-xs text-slate-400 font-bold w-24 shrink-0">
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
                      { label: "Generate Reports", desc: "Produce company, dept & contributor reports", tab: "insights" as TabKey, icon: <MdAssessment size={20} />, color: "bg-primary/10 text-primary" },
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

              {/* REPORTS & INSIGHTS TAB */}
              {activeTab === "insights" && (
                <div className="space-y-8">
                  {/* Company Performance Summary */}
                  <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.05] rotate-12 translate-x-12 -translate-y-8 pointer-events-none text-primary">
                      <MdLightbulb size={240} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <MdBarChart size={20} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Company Performance Summary</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Aggregate Score</p>
                          <p className="text-5xl font-black tracking-tighter text-primary">{aggregateScore}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Weighted average</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Completion Rate</p>
                          <p className="text-5xl font-black tracking-tighter text-emerald-500">{completionRate}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Objectives achieved</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unlocked Value</p>
                          <p className="text-5xl font-black tracking-tighter text-slate-900">{unlockedValue}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total outcomes</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data Freshness</p>
                          <p className="text-xl font-black text-slate-700 mt-2">{lastUpdated ? formatDateTime(String(lastUpdated)) : "—"}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <MdSchedule className="text-slate-400" size={12} />
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Archive updated</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-4">
                      <MdLightbulb className="text-amber-500" size={16} /> Strategic Insights
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {INSIGHT_TYPES.map((it) => {
                        const ins = insights.find((i: any) => i.insight_type === it.key);
                        const Icon = it.icon;
                        const isOpen = expandedInsight === it.key;
                        return (
                          <div key={it.key} className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                            <div 
                              onClick={() => ins && setExpandedInsight(isOpen ? null : it.key)}
                              title={!ins ? "Click the generate button to generate new insights" : undefined}
                              className={`flex items-center gap-4 px-6 py-5 transition-all border-l-4 ${
                                isOpen ? "bg-primary/5 border-primary" : 
                                "cursor-pointer hover:bg-slate-50 hover:border-slate-200 active:scale-[0.995] border-transparent"
                              }`}
                            >
                              <div className={`p-3 rounded-2xl ${it.color} shrink-0`}>
                                <Icon size={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-black text-slate-900">{it.label}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {ins ? (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                    <MdCheck size={12} /> Last run: {formatDateTime(ins.generated_at || ins.updated_at || ins.created_at || (archive as any)?.updated_at)}
                                    </span>
                                  ) : (
                                    "Not generated yet"
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  disabled={busyAction !== null}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void runInsight(it.key);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-600 uppercase tracking-widest hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  {busyAction === `insight:${it.key}` ? (
                                    <MdRefresh size={13} className="animate-spin" />
                                  ) : (
                                    <MdPlayArrow size={13} />
                                  )}
                                  {ins ? "Re-run" : "Generate"}
                                </button>
                                {ins && (
                                  <div className="p-2 rounded-xl text-slate-400 group-hover:text-primary transition-all">
                                    <MdExpandMore size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                  </div>
                                )}
                              </div>
                            </div>
                            {isOpen && ins && (
                              <div className="px-6 pb-6 border-t border-slate-100 bg-slate-50/50">
                                <InsightRenderer 
                                  type={it.key} 
                                  payload={ins.insight_payload_json ?? ins.content ?? ins.data ?? ins} 
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                              <MdFileDownload size={18} className="text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 capitalize">{String(job.export_type ?? "").replace(/_/g, " ")}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(job.created_at)}</p>
                            </div>
                            <span className="text-[10px] font-black text-slate-600 uppercase bg-slate-100 px-2 py-1 rounded-lg tracking-widest">{job.format}</span>
                            <StatusPill status={job.status} />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => void refreshExportJob(Number(job.id))}
                                disabled={busyAction !== null}
                                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-primary hover:border-primary transition-all"
                                title="Refresh & download if ready"
                              >
                                {busyAction === `job:${job.id}` ? (
                                  <MdRefresh size={15} className="animate-spin" />
                                ) : (
                                  <MdRefresh size={15} />
                                )}
                              </button>
                              {(() => {
                                const fileUrl = extractExportDownloadUrl(job);
                                return fileUrl ? (
                                  <button
                                    onClick={() => window.open(fileUrl, "_blank", "noopener,noreferrer")}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
                                  >
                                    <MdCloudDownload size={13} /> Download
                                  </button>
                                ) : (job.status === "completed" || job.status === "done") ? (
                                  <span className="text-[10px] text-slate-400 italic">No file URL</span>
                                ) : null;
                              })()}
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
