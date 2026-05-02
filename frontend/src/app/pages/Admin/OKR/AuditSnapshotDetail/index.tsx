import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import { okrErrorMessage, okrUnwrap } from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import { routeConstants } from "../../../../../utils/constants";
import { MdArrowBack } from "react-icons/md";

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 pt-2 space-y-6">
          <PageHeader>
            <div>
              <Link
                to={routeConstants.okrAuditLogs}
                className="inline-flex items-center gap-1.5 text-white/90 text-sm hover:underline"
              >
                <MdArrowBack /> Back to audit logs
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2">
                Config snapshot #{snapshotId}
              </h1>
              <p className="text-white/85 text-sm mt-1">
                Resolved configuration captured at execution time.
              </p>
            </div>
          </PageHeader>

          {loading ? (
            <section className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500">
              Loading snapshot...
            </section>
          ) : !snapshot ? (
            <section className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500">
              Snapshot not found.
            </section>
          ) : (
            <>
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div className="rounded-xl bg-slate-50 ring-1 ring-gray-100 p-3">
                    <p className="text-gray-500">Entity type</p>
                    <p className="font-semibold text-gray-900 mt-1">
                      {snapshot.entity_type}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 ring-1 ring-gray-100 p-3">
                    <p className="text-gray-500">Entity ID</p>
                    <p className="font-semibold text-gray-900 mt-1">
                      {snapshot.entity_id}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 ring-1 ring-gray-100 p-3">
                    <p className="text-gray-500">Captured by</p>
                    <p className="font-semibold text-gray-900 mt-1">
                      {snapshot.captured_by}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 ring-1 ring-gray-100 p-3">
                    <p className="text-gray-500">Captured at</p>
                    <p className="font-semibold text-gray-900 mt-1">
                      {formatDateTime(snapshot.captured_at)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-3">
                  Resolved config JSON
                </h2>
                <pre className="rounded-xl bg-slate-50 ring-1 ring-gray-100 p-4 text-xs text-gray-800 overflow-auto max-h-[560px]">
                  {prettyJson}
                </pre>
              </section>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
