import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import { useNavigate } from "react-router-dom";
import { routeConstants } from "../../../../../utils/constants";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { okrAsArray, okrErrorMessage, okrUnwrap } from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import { MdCalendarToday, MdChevronRight } from "react-icons/md";
import { openExportDownload } from "../utils/exportDownloads";
import AnnualReportHeader from "./components/AnnualReportHeader";
import AnnualSummaryCards from "./components/AnnualSummaryCards";
import AnnualExportPanel from "./components/AnnualExportPanel";
import QuarterBreakdown from "./components/QuarterBreakdown";
import { AnnualStats, Archive, ExportFormat } from "./components/types";
import { getArchiveYear, getCompletion, getScore, normalizeArchive } from "./components/utils";

export default function AnnualReportingPage() {
  const navigate = useNavigate();
  const [archives, setArchives] = useState<Archive[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [exportFormat, setExportFormat] = useState<ExportFormat>("PDF");
  const [exporting, setExporting] = useState(false);
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<Set<string | number>>(new Set());

  const loadArchives = useCallback(async () => {
    setLoading(true);
    try {
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.archives,
        isSecureRoute: true,
      });
      const data = okrAsArray<any>(okrUnwrap(res));
      setArchives(data.map((a: any) => normalizeArchive(a)));
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setArchives([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadArchives(); }, [loadArchives]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    archives.forEach((a) => {
      const y = getArchiveYear(a);
      if (y != null) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [archives]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear) && availableYears.length > 0) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const yearArchives = useMemo(
    () =>
      archives.filter((a) => {
        const y = getArchiveYear(a);
        if (y != null) return y === selectedYear;
        return selectedYear === availableYears[0];
      }),
    [archives, selectedYear, availableYears],
  );

  const annualStats: AnnualStats | null = useMemo(() => {
    if (!yearArchives.length) return null;
    const scores = yearArchives.map(getScore).filter((s): s is number => s !== null);
    const completions = yearArchives.map(getCompletion).filter((c): c is number => c !== null);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const avgCompletion = completions.length ? completions.reduce((a, b) => a + b, 0) / completions.length : null;
    const totalObjectives = yearArchives.reduce((s, a) => s + Number(a.total_objectives ?? 0), 0);
    const totalKRs = yearArchives.reduce((s, a) => s + Number(a.total_key_results ?? 0), 0);
    const trend =
      scores.length >= 2
        ? scores[scores.length - 1] - scores[0]
        : null;
    return { avgScore, avgCompletion, totalObjectives, totalKRs, trend, quarters: yearArchives.length };
  }, [yearArchives]);

  const toggleArchive = (id: string | number) => {
    setSelectedArchiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedArchiveIds(new Set(yearArchives.map((a) => a.id)));
  const clearAll = () => setSelectedArchiveIds(new Set());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadArchives();
    } finally {
      setRefreshing(false);
    }
  }, [loadArchives]);

  const handleExport = async () => {
    if (selectedArchiveIds.size === 0) {
      ToastService.error("Select at least one quarter to export.");
      return;
    }
    setExporting(true);
    try {
      const results = await Promise.all(
        Array.from(selectedArchiveIds).map((archiveId) =>
          makeCall({
            method: "POST",
            route: apiRoutes.okr.archiveExports(archiveId),
            body: { export_type: "full_quarter", format: exportFormat },
            isSecureRoute: true,
          }),
        ),
      );
      let downloaded = 0;
      for (const res of results as any[]) {
        const payload = okrUnwrap(res) as any;
        let opened = openExportDownload(payload);
        if (!opened) {
          const jobId = Number(payload?.job?.id ?? payload?.id);
          if (Number.isFinite(jobId) && jobId > 0) {
            try {
              const jobRes = await makeCall({
                method: "GET",
                route: apiRoutes.okr.exportJobById(jobId),
                isSecureRoute: true,
              });
              opened = openExportDownload(okrUnwrap(jobRes));
            } catch {
              opened = false;
            }
          }
        }
        if (opened) downloaded++;
      }
      if (downloaded > 0) {
        ToastService.success(`${downloaded} export${downloaded > 1 ? "s" : ""} downloading.`);
      } else {
        ToastService.success(
          `Export job${selectedArchiveIds.size > 1 ? "s" : ""} created. Download link will appear in archive details once file is available.`,
        );
      }
      clearAll();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        <AnnualReportHeader
          selectedYear={selectedYear}
          availableYears={availableYears}
          onSelectYear={(year) => {
            setSelectedYear(year);
            clearAll();
          }}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((i) => <LoadingSkeleton key={i} className="h-32 rounded-3xl" />)}
            </div>
          ) : (
            <>
              {annualStats ? (
                <AnnualSummaryCards annualStats={annualStats} />
              ) : (
                <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MdCalendarToday size={28} className="text-slate-300" />
                  </div>
                  <p className="text-base font-bold text-slate-500">No archived quarters for {selectedYear}</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Archive completed OKR cycles to generate the annual report.
                  </p>
                  <button
                    onClick={() => navigate(routeConstants.okrArchiveManagement)}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg shadow-slate-900/20"
                  >
                    Go to Archive Management
                    <MdChevronRight size={15} />
                  </button>
                </div>
              )}

              {yearArchives.length > 0 && (
                <QuarterBreakdown
                  year={selectedYear}
                  archives={yearArchives}
                  selectedArchiveIds={selectedArchiveIds}
                  onToggle={toggleArchive}
                  onSelectAllToggle={selectedArchiveIds.size === yearArchives.length ? clearAll : selectAll}
                  onOpenDetail={(archiveId) => navigate(routeConstants.okrArchiveDetail.replace(":archiveId", String(archiveId)))}
                />
              )}

              {yearArchives.length > 0 && (
                <AnnualExportPanel
                  exportFormat={exportFormat}
                  onSetFormat={setExportFormat}
                  selectedCount={selectedArchiveIds.size}
                  totalCount={yearArchives.length}
                  exporting={exporting}
                  onExport={() => void handleExport()}
                />
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
