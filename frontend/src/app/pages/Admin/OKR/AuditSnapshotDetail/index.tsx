import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { okrErrorMessage, okrUnwrap } from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import { routeConstants } from "../../../../../utils/constants";
import { MdHistory, MdChevronLeft, MdDataObject } from "react-icons/md";
import RefreshButton from "../../../../components/common/RefreshButton";
import Button from "../../../../components/Core/ui/Button";

type SnapshotRow = {
  id: number;
  company_id: number;
  entity_type: string;
  entity_id: number;
  resolved_config_json: unknown;
  captured_by: string;
  captured_at: string;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

export default function OkrAuditSnapshotDetailPage() {
  const { snapshotId } = useParams<{ snapshotId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<SnapshotRow | null>(null);

  const load = useCallback(async () => {
    if (!snapshotId) return;
    setLoading(true);
    try {
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.configSnapshotById(snapshotId),
        isSecureRoute: true,
      });

      const data = okrUnwrap(res) as SnapshotRow;
      setSnapshot(data ?? null);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [snapshotId]);

  useEffect(() => {
    void load();
  }, [load]);

  const prettyJson = useMemo(() => {
    if (!snapshot?.resolved_config_json) return "{}";
    try {
      return JSON.stringify(snapshot.resolved_config_json, null, 2);
    } catch {
      return String(snapshot.resolved_config_json);
    }
  }, [snapshot]);

  if (!snapshotId) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-slate-50 p-8 text-center text-gray-500 text-sm">
          Missing snapshot id.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-2 space-y-6">
          <PageHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(routeConstants.okrAuditLogs)}
                  icon={MdChevronLeft}
                  className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95 shadow-inner ring-1 ring-white/20"
                  title="Back to Audit Logs"
                />
                <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner">
                  <MdHistory className="text-3xl text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white capitalize">
                    Config Snapshot #{snapshotId}
                  </h1>
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest font-space mt-1">
                    Resolved configuration captured at execution time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 lg:justify-end">
                <RefreshButton onClick={load} loading={loading} />
              </div>
            </div>
          </PageHeader>

          {loading ? (
            <section className="rounded-3xl border border-slate-100 bg-white p-20 text-center shadow-xl shadow-slate-200/40">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-4">
                <MdHistory className="text-2xl text-slate-300 animate-spin" />
              </div>
              <p className="text-slate-400 font-medium">Loading snapshot details...</p>
            </section>
          ) : !snapshot ? (
            <section className="rounded-3xl border border-slate-100 bg-white p-20 text-center shadow-xl shadow-slate-200/40">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-4">
                <MdHistory className="text-2xl text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium">Snapshot not found.</p>
            </section>
          ) : (
            <>
              <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space mb-1">Entity type</p>
                    <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                      {snapshot.entity_type}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space mb-1">Entity ID</p>
                    <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                      {snapshot.entity_id}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space mb-1">Captured by</p>
                    <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                      {snapshot.captured_by}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space mb-1">Captured at</p>
                    <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                      {formatDateTime(snapshot.captured_at)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                  <MdDataObject className="text-xl text-primary" />
                  <h2 className="text-sm font-black text-slate-900 tracking-widest font-space capitalize">
                    Resolved config JSON
                  </h2>
                </div>
                <div className="p-6 bg-slate-900">
                  <pre className="text-[13px] text-emerald-400/90 font-mono overflow-auto max-h-[640px] custom-scrollbar selection:bg-white/10">
                    {prettyJson}
                  </pre>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
