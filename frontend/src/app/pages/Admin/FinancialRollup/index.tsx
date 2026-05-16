import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  MdChevronLeft,
  MdChevronRight,
  MdPictureAsPdf,
  MdRefresh,
  MdTrendingUp,
  MdBarChart,
  MdEmojiEvents,
  MdShowChart,
  MdGroups,
  MdTimer,
  MdCheckCircle,
  MdSpeed,
} from "react-icons/md";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../components/common/PageHeader";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import {
  okrAsArray,
  okrErrorMessage,
  okrUnwrap,
} from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import LoadingSkeleton from "../../../components/common/LoadingSkeleton";

type Cycle = {
  id: number;
  name: string;
  quarter_label?: string;
};

type FinancialItem = {
  id: number;
  title: string;
  objectiveTitle?: string;
  score?: number;
  value?: number;
  unit?: string;
  target?: number;
};

type FinancialData = {
  financial: {
    count: number;
    totalValue: number;
    avgScore: number;
    items: FinancialItem[];
  };
  nonFinancial: {
    count: number;
    items: FinancialItem[];
  };
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asCurrency(v: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(v);
}

export default function FinancialRollup() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FinancialData>({
    financial: { count: 0, totalValue: 0, avgScore: 0, items: [] },
    nonFinancial: { count: 0, items: [] },
  });

  const pageSize = 5;

  const loadCycles = useCallback(async () => {
    const [cyclesRes, currentCycleRes] = await Promise.all([
      makeCall({
        method: "GET",
        route: apiRoutes.okr.cycles,
        isSecureRoute: true,
      }),
      makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      }),
    ]);

    const rows = okrAsArray<any>(okrUnwrap(cyclesRes));
    const nextCycles = rows.map((c) => ({
      id: Number(c.id),
      name: String(c.name ?? `Cycle #${c.id}`),
      quarter_label: c.quarter_label ? String(c.quarter_label) : undefined,
    }));
    setCycles(nextCycles);

    const currentCycle = okrUnwrap<any>(currentCycleRes);
    const fallbackId = nextCycles[0]?.id ?? null;
    const currentId = Number(currentCycle?.id ?? fallbackId);
    setSelectedCycleId(Number.isFinite(currentId) && currentId > 0 ? currentId : null);
  }, []);

  const loadFinancial = useCallback(async (cycleId: number) => {
    const res = await makeCall({
      method: "GET",
      route: `${apiRoutes.okr.dashboardFinancial}?cycle_id=${cycleId}`,
      isSecureRoute: true,
    });
    const payload = okrUnwrap<any>(res);
    const financial = payload?.financial ?? {};
    const nonFinancial = payload?.nonFinancial ?? {};

    setData({
      financial: {
        count: toNumber(financial.count),
        totalValue: toNumber(financial.totalValue),
        avgScore: toNumber(financial.avgScore),
        items: okrAsArray<any>(financial.items).map((it) => ({
          id: Number(it.id),
          title: String(it.title ?? "Untitled"),
          objectiveTitle: it.objectiveTitle ? String(it.objectiveTitle) : undefined,
          score: it.score != null ? toNumber(it.score) : undefined,
          value: it.value != null ? toNumber(it.value) : undefined,
          unit: it.unit ? String(it.unit) : undefined,
          target: it.target != null ? toNumber(it.target) : undefined,
        })),
      },
      nonFinancial: {
        count: toNumber(nonFinancial.count),
        items: okrAsArray<any>(nonFinancial.items).map((it) => ({
          id: Number(it.id),
          title: String(it.title ?? "Untitled"),
          objectiveTitle: it.objectiveTitle ? String(it.objectiveTitle) : undefined,
          score: it.score != null ? toNumber(it.score) : undefined,
        })),
      },
    });
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadCycles();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setCycles([]);
      setSelectedCycleId(null);
    } finally {
      setLoading(false);
    }
  }, [loadCycles]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedCycleId) return;
    setLoading(true);
    void loadFinancial(selectedCycleId)
      .catch((e) => {
        ToastService.error(okrErrorMessage(e));
        setData({
          financial: { count: 0, totalValue: 0, avgScore: 0, items: [] },
          nonFinancial: { count: 0, items: [] },
        });
      })
      .finally(() => setLoading(false));
  }, [selectedCycleId, loadFinancial]);

  const onRefresh = useCallback(async () => {
    if (!selectedCycleId) return;
    setRefreshing(true);
    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.dashboardRollupRefresh,
        body: { cycle_id: selectedCycleId },
        isSecureRoute: true,
      });
      ToastService.success("Roll-up refresh started. Reloading latest data...");
      await loadFinancial(selectedCycleId);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [selectedCycleId, loadFinancial]);

  const summaryStats = useMemo(() => {
    const allFinancial = data.financial.items;
    const totalTarget = allFinancial.reduce((acc, it) => acc + (it.target || 0), 0);
    const achievedKRs = allFinancial.filter((it) => (it.score || 0) >= 100).length;
    const onTrackKRs = allFinancial.filter((it) => (it.score || 0) >= 70 && (it.score || 0) < 100).length;

    return {
      totalTarget,
      achievedKRs,
      onTrackKRs,
    };
  }, [data.financial.items]);

  const totalPages = Math.max(1, Math.ceil(data.financial.items.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.financial.items.slice(start, start + pageSize);
  }, [data.financial.items, page]);

  const groupedByObjective = useMemo(() => {
    const groups: Record<string, FinancialItem[]> = {};
    pagedItems.forEach((it) => {
      const key = it.objectiveTitle || "General Financial Objectives";
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    });
    return Object.entries(groups).map(([title, items]) => ({ title, items }));
  }, [pagedItems]);

  const exportPdf = useCallback(() => {
    if (data.financial.items.length === 0 && data.nonFinancial.items.length === 0) {
      ToastService.error("No data available to export.");
      return;
    }

    setExporting(true);
    try {
      const cycle = cycles.find((c) => c.id === selectedCycleId);
      const cycleName = cycle?.quarter_label ?? cycle?.name ?? `Cycle ${selectedCycleId}`;
      const generatedAt = new Date().toLocaleString(undefined, {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const colW = pageW - margin * 2;
      let y = margin;

      // ── Header bar ──────────────────────────────────────────────────────
      doc.setFillColor(229, 84, 0);
      doc.rect(0, 0, pageW, 18, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("Financial Roll-up Report", margin, 12);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${cycleName}  ·  Generated: ${generatedAt}`, pageW - margin, 12, { align: "right" });
      y = 26;

      // ── Summary stat cards ───────────────────────────────────────────────
      const cards = [
        { label: "Financial Key Results", value: String(data.financial.count) },
        { label: "Total Financial Value", value: asCurrency(data.financial.totalValue) },
        { label: "Average Score", value: `${data.financial.avgScore.toFixed(1)}%` },
        { label: "Achieved Key Results", value: String(summaryStats.achievedKRs) },
        { label: "On Track Key Results", value: String(summaryStats.onTrackKRs) },
      ];
      const cardW = (colW - 4 * 4) / 5;
      cards.forEach((card, i) => {
        const cx = margin + i * (cardW + 4);
        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(cx, y, cardW, 16, 2, 2, "FD");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(156, 163, 175);
        doc.text(card.label.toUpperCase(), cx + cardW / 2, y + 5, { align: "center" });
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(17, 24, 39);
        doc.text(card.value, cx + cardW / 2, y + 12, { align: "center" });
      });
      y += 24;

      // ── Helper: draw a section table ─────────────────────────────────────
      const drawTable = (
        title: string,
        headers: string[],
        colWidths: number[],
        rows: string[][],
      ) => {
        // Section label
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(55, 65, 81);
        doc.text(title.toUpperCase(), margin, y);
        y += 1;
        doc.setDrawColor(243, 244, 246);
        doc.line(margin, y, margin + colW, y);
        y += 4;

        // Header row
        doc.setFillColor(229, 84, 0);
        doc.rect(margin, y, colW, 7, "F");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        let hx = margin + 2;
        headers.forEach((h, idx) => {
          doc.text(h, hx, y + 5);
          hx += colWidths[idx];
        });
        y += 7;

        // Data rows
        rows.forEach((row, ri) => {
          // Page break guard
          if (y + 8 > pageH - 14) {
            doc.addPage();
            y = 14;
          }
          doc.setFillColor(ri % 2 === 0 ? 255 : 249, ri % 2 === 0 ? 255 : 250, ri % 2 === 0 ? 255 : 251);
          doc.rect(margin, y, colW, 7, "F");
          doc.setDrawColor(243, 244, 246);
          doc.line(margin, y + 7, margin + colW, y + 7);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(17, 24, 39);
          let rx = margin + 2;
          row.forEach((cell, ci) => {
            const cw = colWidths[ci] - 4;
            const truncated = doc.splitTextToSize(cell, cw)[0] as string;
            doc.text(truncated, rx, y + 5);
            rx += colWidths[ci];
          });
          y += 7;
        });
        y += 6;
      };

      // ── Financial Key Results table ──────────────────────────────────────────────
      if (data.financial.items.length > 0) {
        const fHeaders = ["Key Result", "Objective", "Score", "Actual Value", "Target Value", "Unit"];
        const fWidths = [70, 60, 30, 35, 35, 20];
        const fRows = data.financial.items.map((item) => [
          item.title,
          item.objectiveTitle ?? "—",
          item.score != null ? `${Math.max(0, Math.min(100, toNumber(item.score))).toFixed(1)}%` : "—",
          item.value != null ? asCurrency(item.value) : "—",
          item.target != null ? asCurrency(item.target) : "—",
          item.unit ?? "—",
        ]);
        drawTable(`Financial Key Results (${data.financial.items.length})`, fHeaders, fWidths, fRows);
      }

      // ── Non-Financial Key Results table ──────────────────────────────────────────
      if (data.nonFinancial.items.length > 0) {
        const nHeaders = ["Key Result", "Objective", "Score"];
        const nWidths = [110, 100, 40];
        const nRows = data.nonFinancial.items.map((item) => [
          item.title,
          item.objectiveTitle ?? "—",
          item.score != null ? `${toNumber(item.score).toFixed(1)}%` : "—",
        ]);
        drawTable(`Non-Financial Key Results (${data.nonFinancial.items.length})`, nHeaders, nWidths, nRows);
      }

      // ── Footer on every page ─────────────────────────────────────────────
      const totalPages = (doc.internal as any).getNumberOfPages() as number;
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(249, 250, 251);
        doc.rect(0, pageH - 10, pageW, 10, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(156, 163, 175);
        doc.text("Kacha Digital Financial Service S.C — Confidential", margin, pageH - 4);
        doc.text(`Page ${p} of ${totalPages}  ·  Financial Roll-up  ·  ${cycleName}`, pageW - margin, pageH - 4, { align: "right" });
      }

      // ── Download ─────────────────────────────────────────────────────────
      const safeLabel = cycleName.replace(/[^a-zA-Z0-9_-]/g, "_");
      doc.save(`Financial_Rollup_${safeLabel}.pdf`);

    } finally {
      setExporting(false);
    }
  }, [cycles, data, selectedCycleId, summaryStats]);

  return (
    <AdminLayout>
      <PageHeader>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white font-heading">Financial Roll-up Report</h1>
          <p className="text-white/90 text-sm md:text-base font-base">
            Live financial and non-financial KR performance by cycle
          </p>
        </div>

        <div className="mt-4 md:mt-0 ml-auto flex flex-wrap items-center gap-3">
          <select
            value={selectedCycleId ?? ""}
            onChange={(e) => {
              setSelectedCycleId(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-xl border border-white/20 bg-white/95 text-k-dark-grey px-3 py-2 text-sm font-bold"
          >
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.quarter_label || cycle.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => void onRefresh()}
            disabled={refreshing || !selectedCycleId}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/95 text-k-dark-grey rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
          >
            <MdRefresh className={`text-lg ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>

          <button
            onClick={exportPdf}
            disabled={exporting || data.financial.items.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-primary rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
          >
            <MdPictureAsPdf className="text-xl" />
            Export PDF
          </button>
        </div>
      </PageHeader>

      <main className="relative p-4 md:p-8 space-y-12">
        <div className="editorial-blob" />

        {loading ? (
          <div className="space-y-6">
            <LoadingSkeleton className="h-28 rounded-3xl" />
            <LoadingSkeleton className="h-96 rounded-3xl" />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-16">
            {/* Executive Summary Section */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-8 bg-primary rounded-full" />
                <h2 className="text-2xl font-bold font-heading text-k-dark-grey">Executive Summary</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Score Hero - Bento Large */}
                <div className="lg:col-span-2 xl:col-span-2 bg-primary rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl hover-premium group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <MdEmojiEvents className="text-secondary text-2xl" />
                        <span className="text-white/80 font-bold uppercase tracking-wider text-xs font-label">
                          Cycle Performance
                        </span>
                      </div>
                      <h3 className="text-5xl font-black font-custom-num tracking-tighter">
                        {data.financial.avgScore.toFixed(1)}%
                      </h3>
                      <p className="text-white/70 mt-2 font-medium max-w-[200px] leading-relaxed">
                        Average completion across all financial objectives
                      </p>
                    </div>
                    <div className="mt-8">
                      <div className="flex justify-between text-sm mb-2 font-bold">
                        <span>Overall Progress</span>
                        <span>{data.financial.avgScore.toFixed(0)}%</span>
                      </div>
                      <div className="h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm p-0.5">
                        <div
                          className="h-full bg-secondary rounded-full shadow-[0_0_15px_rgba(253,216,0,0.5)] transition-all duration-1000 ease-out"
                          style={{ width: `${data.financial.avgScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actual vs Target Bento */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-gray-200 shadow-xl hover-premium flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <MdShowChart className="text-primary text-xl" />
                      </div>
                      <span className="text-k-medium-grey font-black uppercase tracking-widest text-[10px]">
                        Financial Value
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-k-medium-grey font-bold mb-1">Actual Revenue</p>
                        <p className="text-3xl font-black text-k-dark-grey font-custom-num tracking-tight">
                          {asCurrency(data.financial.totalValue)}
                        </p>
                      </div>
                      <div className="h-px bg-gray-100 w-full" />
                      <div>
                        <p className="text-xs text-k-medium-grey font-bold mb-1">Target Revenue</p>
                        <p className="text-xl font-bold text-k-dark-grey/60 font-custom-num tracking-tight">
                          {asCurrency(summaryStats.totalTarget)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Small Bento Stats */}
                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-gray-50 rounded-[2rem] p-6 border border-gray-200 shadow-lg hover-premium flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
                      <MdCheckCircle className="text-success text-2xl" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-k-medium-grey">Achieved</p>
                      <p className="text-2xl font-black text-k-dark-grey font-custom-num">{summaryStats.achievedKRs}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-[2rem] p-6 border border-gray-200 shadow-lg hover-premium flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-info/10 flex items-center justify-center">
                      <MdSpeed className="text-info text-2xl" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-k-medium-grey">On Track</p>
                      <p className="text-2xl font-black text-k-dark-grey font-custom-num">{summaryStats.onTrackKRs}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Detailed Financial Objectives */}
            <section className="animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-secondary rounded-full" />
                  <div>
                    <h2 className="text-2xl font-bold font-heading text-k-dark-grey">Financial Objectives</h2>
                    <p className="text-k-medium-grey text-sm font-medium">Breakdown of performance by objective</p>
                  </div>
                </div>
                {data.financial.items.length > 0 && (
                  <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-k-medium-grey shadow-sm border border-gray-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                    >
                      <MdChevronLeft size={24} />
                    </button>

                    <div className="px-4 flex items-center gap-2">
                      <span className="text-xs font-bold text-k-medium-grey uppercase tracking-widest">
                        Page {page} <span className="text-k-medium-grey/40 mx-1">/</span> {totalPages}
                      </span>
                    </div>

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-k-medium-grey shadow-sm border border-gray-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                    >
                      <MdChevronRight size={24} />
                    </button>
                  </div>
                )}
              </div>

              {data.financial.items.length === 0 ? (
                <div className="bg-white rounded-[3rem] border-2 border-dashed border-gray-200 p-20 text-center flex flex-col items-center">
                  <div className="w-24 h-24 bg-gray-50 flex items-center justify-center rounded-[2rem] mb-6 animate-bounce shadow-inner">
                    <MdBarChart size={48} className="text-k-medium-grey" />
                  </div>
                  <h3 className="text-xl font-bold text-k-dark-grey mb-2">No Financial Records Found</h3>
                  <p className="text-k-medium-grey max-w-sm mx-auto leading-relaxed">
                    We couldn't find any financial key results for the selected cycle. Try refreshing or switching to a different cycle.
                  </p>
                </div>
              ) : (
                <div className="space-y-12">
                  {groupedByObjective.map((group, gIdx) => (
                    <div key={group.title} className="space-y-6">
                      <div className="flex items-center gap-4 px-4">
                        <span className="flex-none text-xs font-black text-primary uppercase tracking-[0.2em]">
                          Objective Group {gIdx + 1}
                        </span>
                        <div className="h-px bg-gradient-to-r from-gray-200 to-transparent flex-1" />
                        <h3 className="flex-none text-lg font-bold font-heading text-k-dark-grey">{group.title}</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {group.items.map((item) => {
                          const pct = Math.max(0, Math.min(100, toNumber(item.score)));
                          const isAchieved = pct >= 100;
                          const isOnTrack = pct >= 70;

                          return (
                            <div
                              key={item.id}
                              className="group bg-white rounded-[2.5rem] p-8 border border-gray-200 shadow-xl shadow-black/[0.03] hover-premium transition-all relative overflow-hidden"
                            >
                              {/* Background Accent */}
                              <div
                                className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-[0.03] -mr-16 -mt-16 transition-opacity group-hover:opacity-[0.1] ${
                                  isAchieved ? "bg-success" : isOnTrack ? "bg-info" : "bg-primary"
                                }`}
                              />

                              <div className="flex justify-between items-start mb-8">
                                <div className="max-w-[70%]">
                                  <h4 className="text-lg font-bold text-k-dark-grey mb-1 group-hover:text-primary transition-colors">
                                    {item.title}
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-k-medium-grey/60">
                                      Financial Milestone
                                    </span>
                                  </div>
                                </div>
                                <div
                                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                                    isAchieved
                                      ? "bg-success/5 border-success/20 text-success"
                                      : isOnTrack
                                      ? "bg-info/5 border-info/20 text-info"
                                      : "bg-primary/5 border-primary/20 text-primary"
                                  }`}
                                >
                                  {isAchieved ? "Achieved" : isOnTrack ? "On Track" : "Needs Review"}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-6 mb-8">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-k-medium-grey uppercase tracking-widest">
                                    Actual Value
                                  </p>
                                  <p className="text-xl font-bold font-custom-num text-k-dark-grey">
                                    {item.value != null ? asCurrency(item.value) : "—"}
                                    <span className="text-xs text-k-medium-grey/60 ml-1 font-medium">{item.unit}</span>
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-k-medium-grey uppercase tracking-widest">
                                    Target Value
                                  </p>
                                  <p className="text-xl font-bold font-custom-num text-k-dark-grey/60">
                                    {item.target != null ? asCurrency(item.target) : "—"}
                                    <span className="text-xs text-k-medium-grey/40 ml-1 font-medium">{item.unit}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold items-end">
                                  <span className="text-k-medium-grey uppercase tracking-widest text-[9px]">
                                    Progress Tracking
                                  </span>
                                  <span className="text-lg font-black font-custom-num text-k-dark-grey">
                                    {pct.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden p-0.5">
                                  <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--color-primary),0.3)] ${
                                      isAchieved ? "bg-success" : isOnTrack ? "bg-info" : "bg-primary"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Non-Financial Support KRs */}
            <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-8 bg-primary/20 rounded-full" />
                <div>
                  <h2 className="text-2xl font-bold font-heading text-k-dark-grey">Non-Financial Support</h2>
                  <p className="text-k-medium-grey text-sm font-medium">Critical supporting results for this cycle</p>
                </div>
              </div>

              {data.nonFinancial.items.length === 0 ? (
                <div className="bg-gray-50 rounded-[2.5rem] p-12 border border-gray-200 text-center">
                  <p className="text-k-medium-grey font-medium">
                    No non-financial supporting records for this period.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.nonFinancial.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-gray-200 p-6 rounded-[2rem] hover-premium transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <MdTrendingUp size={20} />
                        </div>
                        <span className="text-lg font-black font-custom-num text-k-dark-grey">
                          {item.score != null ? `${toNumber(item.score).toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-k-dark-grey mb-1 leading-tight">{item.title}</h4>
                      <p className="text-[10px] text-k-medium-grey font-medium line-clamp-1">
                        {item.objectiveTitle || "Strategic Support"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
