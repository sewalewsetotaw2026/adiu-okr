import { MdFileDownload, MdRefresh } from "react-icons/md";
import { ExportFormat } from "./types";

type Props = {
  exportFormat: ExportFormat;
  onSetFormat: (format: ExportFormat) => void;
  selectedCount: number;
  totalCount: number;
  exporting: boolean;
  onExport: () => void;
};

export default function AnnualExportPanel({
  exportFormat,
  onSetFormat,
  selectedCount,
  totalCount,
  exporting,
  onExport,
}: Props) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-7">
      <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
        <MdFileDownload className="text-primary" size={18} /> Export Annual Report
      </h2>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Format</label>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {(["PDF", "CSV", "XLSX"] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => onSetFormat(fmt)}
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
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 mb-1">
            {selectedCount === 0
              ? "Select quarters above to export"
              : `Exporting ${selectedCount} of ${totalCount} quarter${totalCount !== 1 ? "s" : ""}`}
          </p>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: totalCount ? `${(selectedCount / totalCount) * 100}%` : "0%" }}
            />
          </div>
        </div>
        <button
          disabled={exporting || selectedCount === 0}
          onClick={onExport}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all disabled:opacity-50 shadow-lg shadow-slate-900/20"
        >
          {exporting ? (
            <MdRefresh size={14} className="animate-spin" />
          ) : (
            <MdFileDownload size={14} />
          )}
          Export Selected
        </button>
      </div>
    </div>
  );
}
