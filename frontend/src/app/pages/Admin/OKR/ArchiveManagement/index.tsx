import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import { routeConstants } from "../../../../../utils/constants";
import ArchiveQuarterModal, {
  type ArchiveQuarterOption,
} from "../components/modals/ArchiveQuarterModal";
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
  MdArchive,
  MdChecklist,
  MdCloudDownload,
  MdOpenInNew,
  MdTrendingUp,
} from "react-icons/md";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";

type ArchiveStatus = "ready" | "archiving" | "archived" | "failed";

type ArchiveRow = {
  id: number;
  cycleId: number;
  quarter: string;
  cycle: string;
  status: ArchiveStatus;
  archivedAt: string | null;
  reports: number;
  insights: number;
  exports: number;
};

type CycleRow = {
  id: number;
  name: string;
  quarterLabel: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

function normalizeArchiveStatus(statusRaw: unknown): ArchiveStatus {
  const status = String(statusRaw ?? "").toUpperCase();
  if (status === "PENDING") return "archiving";
  if (status === "COMPLETED") return "archived";
  if (status === "FAILED") return "failed";
  return "ready";
}

function statusBadge(status: ArchiveStatus) {
  const map = {
    ready: { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", label: "Ready" },
    archiving: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", label: "Processing" },
    archived: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", label: "Archived" },
    failed: { bg: "bg-red-50", text: "text-red-600", border: "border-red-100", label: "Failed" },
  } as const;

  const style = map[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border font-space ${style.bg} ${style.text} ${style.border}`}
    >
      <span className={`w-1 h-1 rounded-full ${status === 'archiving' ? 'animate-pulse' : ''} bg-current`} />
      {style.label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ArchiveManagementPage() {
  const [loading, setLoading] = useState(true);
  const [creatingArchive, setCreatingArchive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const [cycles, setCycles] = useState<CycleRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [archivesRes, cyclesRes] = await Promise.all([
        makeCall({
          method: "GET",
          route: apiRoutes.okr.archives,
          isSecureRoute: true,
        }),
        makeCall({
          method: "GET",
          route: apiRoutes.okr.cycles,
          isSecureRoute: true,
        }),
      ]);

      const archiveRows = okrAsArray<any>(okrUnwrap(archivesRes));
      const cycleRows = okrAsArray<any>(okrUnwrap(cyclesRes));

      setArchives(
        archiveRows.map((a) => ({
          id: Number(a.id),
          cycleId: Number(a.cycle_id),
          quarter:
            String(a.quarter_name ?? "").trim() ||
            String(a.cycle?.quarter_label ?? "").trim() ||
            String(a.cycle?.name ?? "").trim() ||
            `Archive #${a.id}`,
          cycle:
            String(a.cycle?.name ?? "").trim() ||
            String(a.cycle?.quarter_label ?? "").trim() ||
            "-",
          status: normalizeArchiveStatus(a.status),
          archivedAt: typeof a.archived_at === "string" ? a.archived_at : null,
          reports: Number(a._count?.reports ?? 0) || 0,
          insights: Number(a._count?.insights ?? 0) || 0,
          exports: Number(a._count?.exportJobs ?? 0) || 0,
        })),
      );

      setCycles(
        cycleRows.map((c) => ({
          id: Number(c.id),
          name: String(c.name ?? `Cycle #${c.id}`),
          quarterLabel: String(c.quarter_label ?? ""),
          status: String(c.status ?? ""),
          startDate: typeof c.start_date === "string" ? c.start_date : null,
          endDate: typeof c.end_date === "string" ? c.end_date : null,
        })),
      );
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setArchives([]);
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!okrFeatureFlags.archive) return;
    void load();
  }, [load]);

  const archiveQuarterOptions = useMemo<ArchiveQuarterOption[]>(() => {
    const archivedCycleIds = new Set(archives.map((a) => a.cycleId));
    return cycles
      .filter((c) => c.status.toUpperCase() === "CLOSED")
      .filter((c) => !archivedCycleIds.has(c.id))
      .map((c) => ({
        id: String(c.id),
        label:
          c.quarterLabel || c.name
            ? `${c.quarterLabel || c.name} (${formatDate(c.startDate)} - ${formatDate(c.endDate)})`
            : `Cycle ${c.id}`,
      }));
  }, [archives, cycles]);

  const totalArchives = archives.length;
  const reportsReady = archives.filter((a) => a.reports > 0).length;
  const exportsReady = archives.reduce((sum, a) => sum + a.exports, 0);

  const handleArchiveQuarter = useCallback(
    async (cycleId: string) => {
      const parsed = Number(cycleId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        ToastService.error("Invalid cycle selected.");
        return;
      }
      setCreatingArchive(true);
      try {
        await makeCall({
          method: "POST",
          route: apiRoutes.okr.archives,
          body: { cycle_id: parsed },
          isSecureRoute: true,
        });
        ToastService.success("Quarter archived successfully.");
        setModalOpen(false);
        await load();
      } catch (e) {
        ToastService.error(okrErrorMessage(e));
      } finally {
        setCreatingArchive(false);
      }
    },
    [load],
  );

  if (!okrFeatureFlags.archive) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-slate-50 p-8 text-center text-gray-500 text-sm">
          Archive disabled (feature flag).
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-2 space-y-6">
          <PageHeader>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Archive Management
                </h1>
                <p className="text-white/85 text-sm mt-1">
                  Quarterly archives, reports, insights, and exports.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RefreshButton
                  onClick={load}
                  loading={loading}
                  className="bg-white/10 ring-white/30 text-white hover:bg-white/20"
                />
                <button
                  type="button"
                  disabled={creatingArchive || archiveQuarterOptions.length === 0}
                  onClick={() => setModalOpen(true)}
                  className="rounded-xl bg-white/15 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/30 hover:bg-white/25 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {creatingArchive ? "Archiving..." : "Archive Quarter"}
                </button>
              </div>
            </div>
          </PageHeader>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative overflow-hidden group rounded-3xl p-6 text-white shadow-2xl shadow-primary/20 bg-primary">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <MdArchive className="text-8xl" />
              </div>
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 mb-6 backdrop-blur-sm">
                  <MdArchive className="text-2xl" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 font-space mb-1">Total Archives</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black tracking-tighter">{totalArchives}</p>
                  <MdTrendingUp className="text-white/40" />
                </div>
              </div>
            </div>

            <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40 hover:border-primary/20 transition-all">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mb-6 group-hover:scale-110 transition-transform">
                <MdChecklist className="text-2xl" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-space mb-1">Reports Ready</p>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">
                {reportsReady}
              </p>
            </div>

            <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40 hover:border-primary/20 transition-all">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 mb-6 group-hover:scale-110 transition-transform">
                <MdCloudDownload className="text-2xl" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-space mb-1">Export Jobs</p>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">
                {exportsReady}
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest font-space">
                Historical Performance Archives
              </h2>
            </div>

            {loading ? (
              <div className="p-8 space-y-4">
                <LoadingSkeleton variant="table-row" count={4} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm text-left">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">
                        Cycle / Quarter
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">
                        Archived Date
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">
                        Reports
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">
                        Insights
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space text-center">
                        Status
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {archives.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-20 text-center"
                        >
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                              <MdArchive className="text-2xl text-slate-300" />
                            </div>
                            <p className="text-slate-400 font-medium">No archives available yet.</p>
                            <p className="text-slate-400 text-xs mt-1">Close a cycle to start archiving quarterly performance.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      archives.map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50/50 transition-colors group"
                        >
                          <td className="px-6 py-5">
                            <p className="font-bold text-slate-900 uppercase tracking-tight">
                              {r.quarter}
                            </p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-space mt-1">
                              {r.cycle}
                            </p>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-slate-600 font-medium">
                              {formatDate(r.archivedAt)}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-slate-900 font-bold font-space">
                              {String(r.reports).padStart(2, '0')}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-slate-900 font-bold font-space">
                            {String(r.insights).padStart(2, '0')}
                          </td>
                          <td className="px-6 py-5 text-center">
                            {statusBadge(r.status)}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Link
                              to={routeConstants.okrArchiveDetail.replace(
                                ":archiveId",
                                String(r.id),
                              )}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-widest font-space hover:border-primary hover:text-primary hover:shadow-lg hover:shadow-primary/5 transition-all"
                            >
                              Open <MdOpenInNew className="text-sm" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      <ArchiveQuarterModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        options={archiveQuarterOptions}
        onConfirm={handleArchiveQuarter}
      />
    </AdminLayout>
  );
}
