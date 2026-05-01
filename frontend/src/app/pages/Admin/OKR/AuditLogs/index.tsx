import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import {
  okrAsArray,
  okrErrorMessage,
  okrUnwrap,
} from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import { routeConstants } from "../../../../../utils/constants";
import { MdOutlineHistory, MdOpenInNew, MdChevronRight } from "react-icons/md";

type AuditRow = {
  id: number;
  entity_type: string;
  entity_id: number;
  action_type: string;
  old_value_json: unknown;
  new_value_json: unknown;
  changed_by: string;
  changed_at: string;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function extractSnapshotId(row: AuditRow): number | null {
  const candidates = [row.new_value_json, row.old_value_json];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const o = candidate as Record<string, unknown>;
    const raw = o.snapshot_id ?? o.snapshotId ?? o.config_snapshot_id;
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

export default function OkrAuditLogsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query: Record<string, string | number> = {};
      if (entityType.trim()) query.entity_type = entityType.trim();
      if (entityId.trim()) {
        const parsed = Number(entityId);
        if (Number.isInteger(parsed) && parsed > 0) {
          query.entity_id = parsed;
        }
      }

      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.auditLogs,
        query,
        isSecureRoute: true,
      });

      setRows(okrAsArray<AuditRow>(okrUnwrap(res)));
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRows = rows.length;

  const entityTypes = useMemo(
    () => [
      "",
      "CYCLE",
      "COMPANY_OBJECTIVE",
      "COMPANY_KR",
      "DEPARTMENT_OBJECTIVE",
      "DEPARTMENT_KR",
      "EMPLOYEE_OBJECTIVE",
      "EMPLOYEE_KR",
      "ARCHIVE",
      "EXPORT",
    ],
    [],
  );

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-2 space-y-6">
          <nav className="flex flex-wrap items-center gap-2 text-sm pt-4">
            <button
              type="button"
              onClick={() => navigate(routeConstants.okr)}
              className="text-gray-500 hover:text-gray-800 transition-colors"
            >
              OKR
            </button>
            <MdChevronRight className="text-gray-300 shrink-0 text-lg" />
            <span className="text-gray-800 font-medium">Audit Logs</span>
          </nav>

          <PageHeader>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                <MdOutlineHistory /> OKR Audit Logs
              </h1>
              <p className="text-white/85 text-sm mt-1">
                Trace lifecycle changes, approvals, and configuration snapshots.
              </p>
            </div>
          </PageHeader>

          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white"
              >
                {entityTypes.map((t) => (
                  <option key={t || "all"} value={t}>
                    {t || "All Entity Types"}
                  </option>
                ))}
              </select>

              <input
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="Entity ID"
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />

              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-medium hover:opacity-95 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Apply Filter"}
              </button>

              <div className="rounded-xl bg-slate-50 ring-1 ring-gray-100 px-3 py-2.5 text-sm text-gray-600">
                Total Logs:{" "}
                <span className="font-semibold text-gray-900">{totalRows}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      When
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Entity
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Entity ID
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Action
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Changed By
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Snapshot
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        Loading Logs...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No Logs Found for Current Filter.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const snapshotId = extractSnapshotId(row);
                      return (
                        <tr
                          key={row.id}
                          className="border-t border-gray-100 hover:bg-slate-50/60"
                        >
                          <td className="px-4 py-3 text-gray-600">
                            {formatDateTime(row.changed_at)}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {row.entity_type}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {row.entity_id}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {row.action_type}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {row.changed_by}
                          </td>
                          <td className="px-4 py-3">
                            {snapshotId ? (
                              <Link
                                to={routeConstants.okrConfigSnapshotDetail.replace(
                                  ":snapshotId",
                                  String(snapshotId),
                                )}
                                className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
                              >
                                #{snapshotId}{" "}
                                <MdOpenInNew className="text-sm" />
                              </Link>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
