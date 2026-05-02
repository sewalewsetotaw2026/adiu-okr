import { useCallback, useEffect, useState } from "react";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import RefreshButton from "../../../components/common/RefreshButton";
import { routeConstants } from "../../../../utils/constants";
import { MdGroups } from "react-icons/md";
import MetricStat from "../../Admin/OKR/components/MetricStat";
import OkrStatusBadge from "../components/OkrStatusBadge";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import { okrAsArray, okrErrorMessage, okrUnwrap } from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";

type Member = {
  id: string;
  name: string;
  objective: string;
  progress: number;
  blocked: boolean;
};

function parseTeamSummary(payload: unknown): Member[] {
  const visit = (node: unknown): unknown[] => {
    if (Array.isArray(node)) return node;
    if (!node || typeof node !== "object") return [];
    const o = node as Record<string, unknown>;
    for (const k of [
      "members",
      "rows",
      "items",
      "team",
      "reports",
      "summaries",
      "data",
    ]) {
      if (Array.isArray(o[k])) return o[k] as unknown[];
      if (o[k] && typeof o[k] === "object") {
        const inner = visit(o[k]);
        if (inner.length) return inner;
      }
    }
    return [];
  };

  const arr = visit(payload);
  return arr.map((row: any, i: number) => ({
    id: String(row.id ?? row.employee_id ?? i),
    name:
      row.employee_name ??
      row.employee?.full_name ??
      row.full_name ??
      row.name ??
      "—",
    objective:
      row.objective_title ?? row.employee_objective?.title ?? row.title ?? "—",
    progress: (() => {
      if (row.progress !== undefined) return Number(Number(row.progress).toFixed(2));
      const tgt = Number(row.target_value ?? 0);
      const cur = Number(row.current_value ?? 0);
      return tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
    })(),
    blocked: Boolean(
      row.blocked ?? row.is_blocked ?? row.at_risk ?? row.has_blockers,
    ),
  }));
}

export default function TeamExecutionMonitorPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = okrUnwrap(cycleRes) as { id?: number } | null;
      const cid = cycle?.id != null ? Number(cycle.id) : null;
      if (!cid) {
        setMembers([]);
        return;
      }
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.managerTeamSummary,
        query: { cycle_id: cid },
        isSecureRoute: true,
      });
      const raw = okrUnwrap(res);
      const list = okrAsArray(raw);
      setMembers(list.length ? parseTeamSummary(list) : parseTeamSummary(raw));
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const blocked = members.filter((m) => m.blocked).length;
  const avg =
    members.length > 0
      ? Number((members.reduce((s, m) => s + m.progress, 0) / members.length).toFixed(2))
      : 0;

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white -mx-4 md:-mx-8 px-4 md:px-8">
        <ExecutionShell
          breadcrumbs={[
            { label: "My Team", to: routeConstants.managerMyTeam },
            { label: "Team Execution" },
          ]}
          title="Team Execution Monitor"
          subtitle="Monitor team objective progress for the current cycle."
          icon={<MdGroups className="text-2xl" />}
          actions={<RefreshButton onClick={load} loading={loading} />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <MetricStat
                label="Team Rows"
                value={loading ? "…" : members.length}
              />
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <MetricStat
                label="Avg Progress"
                value={loading ? "…" : `${avg}%`}
              />
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <MetricStat
                label="Flagged / Blocked"
                value={loading ? "…" : blocked}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden mt-4">
            {loading ? (
              <p className="p-8 text-center text-sm text-k-medium-grey">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-k-light-grey/40 text-left">
                      <th className="px-5 py-3 font-semibold text-k-dark-grey">
                        Team Member
                      </th>
                      <th className="px-5 py-3 font-semibold text-k-dark-grey">
                        Employee Objective
                      </th>
                      <th className="px-5 py-3 font-semibold text-k-dark-grey">
                        Progress
                      </th>
                      <th className="px-5 py-3 font-semibold text-k-dark-grey">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-5 py-10 text-center text-k-medium-grey"
                        >
                          No team execution data for this cycle, or the API
                          response uses a different shape.
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b border-gray-50 last:border-0 hover:bg-k-light-grey/30 transition-colors"
                        >
                          <td className="px-5 py-4 font-medium text-k-dark-grey">
                            {m.name}
                          </td>
                          <td className="px-5 py-4 text-k-medium-grey">
                            {m.objective}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 max-w-[140px]">
                              <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all duration-300"
                                  style={{ width: `${m.progress}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-k-dark-grey font-semibold">
                                {m.progress}%
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {m.blocked ? (
                              <OkrStatusBadge
                                label="Blocked"
                                tone="error"
                                size="xs"
                              />
                            ) : (
                              <OkrStatusBadge
                                label="On Track"
                                tone="success"
                                size="xs"
                              />
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ExecutionShell>
      </div>
    </EmployeeLayout>
  );
}
