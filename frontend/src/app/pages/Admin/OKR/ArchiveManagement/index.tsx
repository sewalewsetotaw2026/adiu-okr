import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import RefreshButton from "../../../../components/common/RefreshButton";
import Button from "../../../../components/Core/ui/Button";
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
  MdTrendingUp,
  MdCalendarToday,
  MdAssessment,
  MdChevronRight,
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
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <MdArchive size={24} className="text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tighter leading-none text-slate-900">
                    Archive Management
                  </h1>
                  <p className="text-slate-500 text-sm mt-1">
                    Quarterly performance archives, reports &amp; exports
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RefreshButton onClick={load} loading={loading} />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={creatingArchive || archiveQuarterOptions.length === 0}
                  onClick={() => setModalOpen(true)}
                  icon={MdArchive}
                  className="uppercase tracking-widest font-space text-[10px] font-black"
                >
                  {creatingArchive ? "Archiving…" : "Archive Quarter"}
                </Button>
              </div>
            </div>

            {/* Stat strip */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { label: "Total Archives", value: totalArchives,  icon: <MdArchive size={18} />,       color: "text-primary",    bg: "bg-primary/10" },
                { label: "With Reports",   value: reportsReady,   icon: <MdChecklist size={18} />,      color: "text-amber-600",  bg: "bg-amber-50" },
                { label: "Export Jobs",    value: exportsReady,   icon: <MdCloudDownload size={18} />,  color: "text-sky-600",    bg: "bg-sky-50" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
                  <div className={`inline-flex p-2 rounded-xl ${s.bg} ${s.color} mb-2`}>{s.icon}</div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                  <p className="text-3xl font-black tracking-tighter text-slate-900 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Archive list */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1,2,3,4,5,6].map(i => <LoadingSkeleton key={i} className="h-44 rounded-3xl" />)}
            </div>
          ) : archives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
                <MdArchive size={36} className="text-slate-300" />
              </div>
              <p className="text-slate-600 font-bold text-lg">No archives yet</p>
              <p className="text-slate-400 text-sm mt-1 max-w-xs text-center">
                Close an OKR cycle and archive it to build your performance history.
              </p>
              {archiveQuarterOptions.length > 0 && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-6 flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                >
                  <MdArchive size={15} /> Archive a Quarter
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {archives.map((r) => (
                <Link
                  key={r.id}
                  to={routeConstants.okrArchiveDetail.replace(":archiveId", String(r.id))}
                  className="group bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/30 hover:shadow-2xl hover:shadow-slate-200/60 hover:-translate-y-1 hover:border-primary/20 transition-all overflow-hidden flex flex-col"
                >
                  {/* Card header */}
                  <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {statusBadge(r.status)}
                      </div>
                      <h3 className="text-lg font-black tracking-tighter leading-tight text-slate-900">
                        {r.quarter}
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">{r.cycle}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <MdArchive size={20} className="text-primary" />
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="flex-1 px-6 py-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MdCalendarToday size={13} className="text-slate-400" />
                      <span>Archived {formatDate(r.archivedAt)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Reports",  value: r.reports,  icon: <MdAssessment size={14} />,    color: "text-primary" },
                        { label: "Insights", value: r.insights, icon: <MdTrendingUp size={14} />,    color: "text-amber-500" },
                        { label: "Exports",  value: r.exports,  icon: <MdCloudDownload size={14} />, color: "text-sky-500" },
                      ].map((m) => (
                        <div key={m.label} className="bg-slate-50 rounded-2xl px-3 py-2.5 text-center">
                          <div className={`flex justify-center mb-1 ${m.color}`}>{m.icon}</div>
                          <p className="text-lg font-black text-slate-900 tracking-tighter leading-none">{m.value}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">View Details</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                      <MdChevronRight size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
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
