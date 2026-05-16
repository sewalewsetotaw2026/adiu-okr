import { useState, useEffect, useCallback } from "react";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import PageHeader from "../../../components/common/PageHeader";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import { okrUnwrap } from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import {
  importOKR,
  exportQuarterlyOKR,
  exportMonthlyPlans,
  exportWeeklyPlans,
  downloadTemplate,
  type ImportReport,
} from "../../../services/okr-import-export.api";
import {
  MdUploadFile,
  MdDownload,
  MdDescription,
  MdCheckCircle,
  MdError,
  MdWarning,
  MdClose,
  MdCloudUpload,
  MdInsertDriveFile,
} from "react-icons/md";

type ImportType = "quarterly" | "monthly" | "weekly";
type ImportMode = "strict" | "partial";
type ActiveSection = "import" | "export";

const IMPORT_TABS: { id: ImportType; label: string; desc: string }[] = [
  { id: "quarterly", label: "Quarterly OKR", desc: "Import objectives and key results aligned to company/employee KRs" },
  { id: "monthly", label: "Monthly Plans", desc: "Import monthly plans under your employee key results" },
  { id: "weekly", label: "Weekly Plans", desc: "Import weekly plans under your monthly plans" },
];

export default function OKRImportExportPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("import");
  const [importType, setImportType] = useState<ImportType>("quarterly");
  const [importMode, setImportMode] = useState<ImportMode>("strict");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Export form state
  const [cycleId, setCycleId] = useState<number | "">("");
  const [monthNumber, setMonthNumber] = useState<number | "">("");
  const [employeeKrId, setEmployeeKrId] = useState<number | "">("");
  const [monthPlanId, setMonthPlanId] = useState<number | "">("");
  const [weekNumber, setWeekNumber] = useState<number | "">("");
  const [exportType, setExportType] = useState<ImportType>("quarterly");

  // Cycles for dropdown
  const [cycles, setCycles] = useState<{ id: number; name: string; quarter_label?: string }[]>([]);

  const loadCycles = useCallback(async () => {
    try {
      const res = await makeCall({ method: "GET", route: apiRoutes.okr.cycles, isSecureRoute: true });
      const data = okrUnwrap(res);
      const list = Array.isArray(data) ? data : (data as any)?.data ?? [];
      setCycles(list.map((c: any) => ({ id: c.id, name: c.name, quarter_label: c.quarter_label })));
      if (list.length > 0 && !cycleId) {
        const open = list.find((c: any) => c.status === "OPEN");
        if (open) setCycleId(open.id);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadCycles(); }, [loadCycles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && f.size > 5 * 1024 * 1024) {
      ToastService.error("File size exceeds 5MB limit.");
      return;
    }
    setFile(f);
    setReport(null);
  };

  const handleImport = async () => {
    if (!file) { ToastService.error("Please select a file."); return; }
    setImporting(true);
    setReport(null);
    try {
      const result = await importOKR(importType, file, importMode);
      setReport(result);
      if (result.failed === 0 && result.succeeded > 0) {
        ToastService.success(`Successfully imported ${result.succeeded} rows!`);
      } else if (result.succeeded > 0) {
        ToastService.success(`Imported ${result.succeeded} rows with ${result.failed} failures.`);
      } else {
        ToastService.error(`Import failed. ${result.failed} rows had errors.`);
      }
    } catch (err: any) {
      ToastService.error(err?.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (!cycleId && exportType !== "weekly") { ToastService.error("Please select a cycle."); return; }
    setExporting(true);
    try {
      if (exportType === "quarterly") {
        await exportQuarterlyOKR(cycleId as number);
      } else if (exportType === "monthly") {
        await exportMonthlyPlans({
          cycleId: cycleId as number,
          monthNumber: monthNumber || undefined,
          employeeKrId: employeeKrId || undefined,
        });
      } else {
        if (!monthPlanId) { ToastService.error("Monthly plan ID is required for weekly export."); setExporting(false); return; }
        await exportWeeklyPlans({
          employeeMonthPlanId: monthPlanId as number,
          weekNumber: weekNumber || undefined,
        });
      }
      ToastService.success("Export downloaded successfully!");
    } catch (err: any) {
      ToastService.error(err?.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async (type: ImportType) => {
    setDownloading(true);
    try {
      await downloadTemplate(type);
      ToastService.success(`${type} template downloaded!`);
    } catch (err: any) {
      ToastService.error(err?.message || "Template download failed.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <EmployeeLayout>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <PageHeader>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">OKR Import & Export</h1>
          <p className="text-white/80 mt-1 text-sm md:text-base">
            Bulk import your OKR plans from Excel/CSV or export your data for offline review
          </p>
        </PageHeader>

        {/* Section Toggle */}
        <div className="flex gap-3 mb-8">
          {(["import", "export"] as ActiveSection[]).map((s) => (
            <button
              key={s}
              onClick={() => { setActiveSection(s); setReport(null); }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer ${
                activeSection === s
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-primary/40 hover:text-primary"
              }`}
            >
              {s === "import" ? <MdUploadFile className="text-lg" /> : <MdDownload className="text-lg" />}
              {s === "import" ? "Import" : "Export"}
            </button>
          ))}
        </div>

        {/* ─── IMPORT SECTION ─── */}
        {activeSection === "import" && (
          <div className="space-y-6">
            {/* Type Tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Select Import Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {IMPORT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setImportType(tab.id); setFile(null); setReport(null); }}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                      importType === tab.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-gray-100 hover:border-gray-200 bg-gray-50/50"
                    }`}
                  >
                    <div className={`text-sm font-bold mb-1 ${importType === tab.id ? "text-primary" : "text-gray-700"}`}>
                      {tab.label}
                    </div>
                    <div className="text-xs text-gray-500 leading-relaxed">{tab.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Download */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MdDescription className="text-2xl text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Download Template</p>
                  <p className="text-xs text-blue-600/70">Get the blank {importType} template with instructions</p>
                </div>
              </div>
              <button
                onClick={() => handleDownloadTemplate(importType)}
                disabled={downloading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <MdDownload /> {downloading ? "Downloading..." : "Download .xlsx"}
              </button>
            </div>

            {/* File Upload + Mode */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">Upload File</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-medium">Mode:</span>
                  {(["strict", "partial"] as ImportMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setImportMode(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        importMode === m
                          ? m === "strict" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {m === "strict" ? "Strict (all or nothing)" : "Partial (skip failures)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                file ? "border-green-300 bg-green-50/50" : "border-gray-200 bg-gray-50/30 hover:border-primary/40 hover:bg-primary/5"
              }`}>
                <input type="file" accept=".xlsx,.csv" onChange={handleFileChange} className="hidden" />
                {file ? (
                  <div className="flex items-center gap-3">
                    <MdInsertDriveFile className="text-3xl text-green-600" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">{file.name}</p>
                      <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={(e) => { e.preventDefault(); setFile(null); setReport(null); }} className="ml-2 p-1 hover:bg-green-200 rounded-full cursor-pointer">
                      <MdClose className="text-green-700" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <MdCloudUpload className="text-4xl text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Drop your .xlsx or .csv file here</p>
                    <p className="text-xs text-gray-400 mt-1">Max 5MB, 500 rows</p>
                  </div>
                )}
              </label>

              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {importing ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing...</>
                ) : (
                  <><MdUploadFile className="text-lg" /> Import {importType} Data</>
                )}
              </button>
            </div>

            {/* Import Report */}
            {report && <ImportReportCard report={report} />}
          </div>
        )}

        {/* ─── EXPORT SECTION ─── */}
        {activeSection === "export" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Select Export Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {IMPORT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setExportType(tab.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      exportType === tab.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-gray-100 hover:border-gray-200 bg-gray-50/50"
                    }`}
                  >
                    <div className={`text-sm font-bold mb-1 ${exportType === tab.id ? "text-primary" : "text-gray-700"}`}>
                      {tab.label}
                    </div>
                  </button>
                ))}
              </div>

              {/* Export Params */}
              <div className="space-y-4">
                {exportType !== "weekly" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cycle *</label>
                    <select
                      value={cycleId}
                      onChange={(e) => setCycleId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                    >
                      <option value="">Select cycle...</option>
                      {cycles.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} {c.quarter_label ? `(${c.quarter_label})` : ""}</option>
                      ))}
                    </select>
                  </div>
                )}

                {exportType === "monthly" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Month Number (optional)</label>
                      <select value={monthNumber} onChange={(e) => setMonthNumber(e.target.value ? Number(e.target.value) : "")} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary">
                        <option value="">All months</option>
                        <option value={1}>Month 1</option>
                        <option value={2}>Month 2</option>
                        <option value={3}>Month 3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee KR ID (optional)</label>
                      <input type="number" value={employeeKrId} onChange={(e) => setEmployeeKrId(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 5" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" />
                    </div>
                  </div>
                )}

                {exportType === "weekly" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Plan ID *</label>
                      <input type="number" value={monthPlanId} onChange={(e) => setMonthPlanId(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 12" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Week Number (optional)</label>
                      <select value={weekNumber} onChange={(e) => setWeekNumber(e.target.value ? Number(e.target.value) : "")} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary">
                        <option value="">All weeks</option>
                        {[1,2,3,4,5].map((w) => <option key={w} value={w}>Week {w}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full mt-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Exporting...</>
                ) : (
                  <><MdDownload className="text-lg" /> Export {exportType} Data</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}

/* ─── Import Report Sub-component ─── */
function ImportReportCard({ report }: { report: ImportReport }) {
  const allSuccess = report.failed === 0 && report.succeeded > 0;
  const allFailed = report.succeeded === 0 && report.failed > 0;

  return (
    <div className={`rounded-2xl border-2 p-6 ${
      allSuccess ? "border-green-200 bg-green-50/50" : allFailed ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50"
    }`}>
      <div className="flex items-center gap-3 mb-4">
        {allSuccess ? <MdCheckCircle className="text-2xl text-green-600" /> :
         allFailed ? <MdError className="text-2xl text-red-600" /> :
         <MdWarning className="text-2xl text-amber-600" />}
        <h3 className={`text-lg font-bold ${allSuccess ? "text-green-800" : allFailed ? "text-red-800" : "text-amber-800"}`}>
          Import {allSuccess ? "Successful" : allFailed ? "Failed" : "Partial Success"}
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white/70 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{report.total_rows}</div>
          <div className="text-xs text-gray-500 font-medium">Total Rows</div>
        </div>
        <div className="bg-white/70 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{report.succeeded}</div>
          <div className="text-xs text-gray-500 font-medium">Succeeded</div>
        </div>
        <div className="bg-white/70 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{report.failed}</div>
          <div className="text-xs text-gray-500 font-medium">Failed</div>
        </div>
      </div>

      {Object.keys(report.created).length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">Created:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(report.created).map(([key, val]) => (
              <span key={key} className="inline-flex items-center gap-1 px-3 py-1 bg-white/80 rounded-lg text-xs font-medium text-gray-700 border border-gray-200">
                {key.replace(/_/g, " ")}: <span className="font-bold text-primary">{val}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {report.errors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-700 mb-2">Errors ({report.errors.length}):</p>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {report.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 bg-white/60 rounded-lg p-2.5 text-xs border border-red-100">
                <span className="shrink-0 font-bold text-red-600 min-w-[50px]">Row {err.row}</span>
                {err.field && <span className="shrink-0 font-mono text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{err.field}</span>}
                <span className="text-red-700">{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
