import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import { routeConstants } from "../../../../utils/constants";
import { MdGroupAdd, MdPersonAdd } from "react-icons/md";
import AssignContributorModal from "../components/modals/AssignContributorModal";
import Button from "../../../components/Core/ui/Button";
import OkrStatusBadge from "../components/OkrStatusBadge";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import { okrAsArray, okrErrorMessage, okrUnwrap } from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import { useDepartments } from "../../Admin/Departments/slice";
import {
  selectDepartments,
  selectDepartmentsLoading,
} from "../../Admin/Departments/slice/selectors";
import { selectAuthUser } from "../../../slice/authSlice/selectors";

type KrRow = {
  id: string;
  krTitle: string;
  objectiveTitle: string;
  contributors: {
    id: number;
    userId: string;
    name: string;
    required: boolean;
  }[];
};

type DepartmentContributorSummary = {
  total_contributors: number;
  active_contributors: number;
  total_employee_objectives: number;
  draft_objectives: number;
  approved_objectives: number;
  published_objectives: number;
};

/** Real backend `department_kr_id` values for POST /okr/contributors. */
async function fetchDepartmentKrRows(
  departmentId: number,
  cycleId: number,
): Promise<KrRow[]> {
  const objRes = await makeCall({
    method: "GET",
    route: apiRoutes.okr.departmentObjectives,
    query: { department_id: departmentId, cycle_id: cycleId },
    isSecureRoute: true,
  });
  const objs = okrAsArray(okrUnwrap(objRes));
  const rows: KrRow[] = [];

  for (const obj of objs) {
    const o = obj as Record<string, unknown>;
    const oid = Number(o.id);
    if (!Number.isFinite(oid)) continue;
    const objTitle = String(o.title ?? "Objective");

    let krs: unknown[] = [];
    try {
      const krRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.departmentKRs(oid),
        isSecureRoute: true,
      });
      krs = okrAsArray(okrUnwrap(krRes));
    } catch {
      krs = [];
    }

    for (const kr of krs) {
      const k = kr as Record<string, unknown>;
      const krId = Number(k.id);
      if (!Number.isFinite(krId)) continue;

      let contribs: KrRow["contributors"] = [];
      try {
        const cRes = await makeCall({
          method: "GET",
          route: apiRoutes.okr.contributors,
          query: { department_kr_id: krId },
          isSecureRoute: true,
        });
        contribs = okrAsArray(okrUnwrap(cRes))
          .map((c: any) => ({
            id: Number(c?.id ?? 0),
            userId: String(c?.user_id ?? ""),
            name:
              c?.user?.full_name ??
              c?.employee?.full_name ??
              c?.full_name ??
              c?.name ??
              "Contributor",
            required: Boolean(
              c?.is_required_for_completion ??
              c?.isRequiredForCompletion ??
              true,
            ),
          }))
          .filter((c: { id: number }) => Number.isFinite(c.id));
      } catch {
        contribs = [];
      }

      rows.push({
        id: String(krId),
        krTitle: String(k.title ?? "—"),
        objectiveTitle: objTitle,
        contributors: contribs,
      });
    }
  }

  return rows;
}

export default function ContributorAssignmentPage() {
  const dispatch = useDispatch();
  const { actions: deptActions } = useDepartments();
  const departments = useSelector(selectDepartments);
  const departmentsLoading = useSelector(selectDepartmentsLoading);
  const user = useSelector(selectAuthUser) as any;
  
  // Robust detection of department ID
  const userDeptId = 
    user?.department_id || 
    user?.employee?.department_id || 
    user?.employee?.employments?.[0]?.department_id;
  
  // Use user's role to determine if they can switch departments
  const isAdmin = [1, 2].includes(Number(user?.role_id)) || 
    ["Admin", "HR", "Super Admin"].includes(user?.role?.name);

  const [allSubordinates, setAllSubordinates] = useState<any[]>([]);
  const [subordinatesLoaded, setSubordinatesLoaded] = useState(false);

  const [rows, setRows] = useState<KrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [summary, setSummary] = useState<DepartmentContributorSummary | null>(
    null,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [activeKrId, setActiveKrId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | "">("");
  const [required, setRequired] = useState(true);
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    dispatch(deptActions.fetchDepartmentsStart({ page: 1, limit: 500 }));
  }, [dispatch, deptActions]);

  const fetchAllSubordinates = useCallback(async () => {
    if (subordinatesLoaded) return;
    try {
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.managerSubordinatePositions,
        isSecureRoute: true,
      });
      const data = okrUnwrap(res);
      setAllSubordinates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch subordinates:", e);
      setAllSubordinates([]);
    } finally {
      setSubordinatesLoaded(true);
    }
  }, [subordinatesLoaded]);

  useEffect(() => {
    void fetchAllSubordinates();
  }, [fetchAllSubordinates]);

  useEffect(() => {
    if (departmentId !== "") return;
    
    if (userDeptId && !isAdmin) {
      setDepartmentId(Number(userDeptId));
    } else if (departments?.length) {
      setDepartmentId(departments[0].id);
    }
  }, [departments, departmentId, userDeptId, isAdmin]);

  const employees = useMemo(() => {
    const source = typeof departmentId === "number"
      ? allSubordinates.filter((m: any) => m.department_id === departmentId)
      : allSubordinates;
    return source
      .map((m: any) => ({
        id: String(m.employee_user_id ?? m.user_id ?? ""),
        employeeId: String(m.employee_id ?? ""),
        name: m.employee_name ?? m.full_name ?? "—",
        role: m.job_title ?? "—",
      }))
      .filter((m) => m.id !== "");
  }, [allSubordinates, departmentId]);

  const loadSummary = useCallback(async () => {
    if (departmentId === "") {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const cycleRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.currentCycle,
        isSecureRoute: true,
      });
      const cycle = okrUnwrap(cycleRes) as { id?: number } | null;
      const cid = cycle?.id != null ? Number(cycle.id) : null;
      setCycleId(cid);
      if (!cid) {
        setRows([]);
        setSummary(null);
        ToastService.error(
          "No open OKR cycle. Open a cycle to load department KRs.",
        );
        return;
      }

      const [list, summaryRes] = await Promise.all([
        fetchDepartmentKrRows(departmentId, cid),
        makeCall({
          method: "GET",
          route: apiRoutes.okr.contributorsDepartmentSummary,
          query: { department_id: departmentId, cycle_id: cid },
          isSecureRoute: true,
        }).catch(() => null),
      ]);

      setRows(list);
      if (summaryRes) {
        setSummary(
          (okrUnwrap(summaryRes) as DepartmentContributorSummary) ?? null,
        );
      } else {
        setSummary(null);
      }
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const activeKr = useMemo(
    () => rows.find((r) => r.id === activeKrId),
    [rows, activeKrId],
  );

  const openAssign = (id: string) => {
    setActiveKrId(id);
    setSelectedEmployeeId("");
    setRequired(true);
    setModalOpen(true);
  };

  const handleAssign = async () => {
    if (selectedEmployeeId === "" || !activeKrId) return;
    setAssignLoading(true);
    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.contributors,
        body: {
          department_kr_id: Number(activeKrId),
          user_id: String(selectedEmployeeId),
          role_type: "EMPLOYEE",
          is_required_for_completion: required,
        },
        isSecureRoute: true,
      });
      ToastService.success("Contributor assigned.");
      setModalOpen(false);
      await loadSummary();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setAssignLoading(false);
    }
  };

  const handleToggleRequired = async (
    contributorId: number,
    currentRequired: boolean,
  ) => {
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.contributorFlag(contributorId),
        body: {
          is_required_for_completion: !currentRequired,
        },
        isSecureRoute: true,
      });
      ToastService.success(
        !currentRequired
          ? "Contributor marked required."
          : "Contributor marked optional.",
      );
      await loadSummary();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    }
  };

  return (
    <EmployeeLayout forceEmployeeSidebar>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white -mx-4 md:-mx-8 px-4 md:px-8">
        <ExecutionShell
          breadcrumbs={[
            { label: "My team", to: routeConstants.managerMyTeam },
            { label: "Contributor assignment" },
          ]}
          title="Contributor assignment"
          subtitle="Assign contributors to department key results for the current cycle."
          icon={<MdGroupAdd className="text-2xl" />}
        >
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {isAdmin ? (
              <label className="text-sm text-k-medium-grey flex items-center gap-2 font-medium">
                <span>Department</span>
                <select
                  value={departmentId === "" ? "" : String(departmentId)}
                  disabled={departmentsLoading}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDepartmentId(v === "" ? "" : Number(v));
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-k-dark-grey focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <option value="">Select…</option>
                  {(departments || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="text-sm">
                <span className="text-k-medium-grey mr-2">Department:</span>
                <span className="font-semibold text-k-dark-grey">
                  {departments?.find(d => d.id === departmentId)?.name || (departmentId ? `Dept #${departmentId}` : "Loading...")}
                </span>
              </div>
            )}
            {cycleId != null ? (
              <span className="text-xs text-k-medium-grey">Cycle ID: {cycleId}</span>
            ) : null}
          </div>

          {summary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl bg-white p-4 ring-1 ring-gray-100 shadow-sm">
                <p className="text-xs text-k-medium-grey font-medium">Contributors</p>
                <p className="text-lg font-semibold text-k-dark-grey mt-1">
                  {summary.active_contributors}/{summary.total_contributors}
                </p>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-gray-100 shadow-sm">
                <p className="text-xs text-k-medium-grey font-medium">Employee objectives</p>
                <p className="text-lg font-semibold text-k-dark-grey mt-1">
                  {summary.total_employee_objectives}
                </p>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-gray-100 shadow-sm">
                <p className="text-xs text-k-medium-grey font-medium">Draft / approved</p>
                <p className="text-lg font-semibold text-k-dark-grey mt-1">
                  {summary.draft_objectives}/{summary.approved_objectives}
                </p>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-gray-100 shadow-sm">
                <p className="text-xs text-k-medium-grey font-medium">Published</p>
                <p className="text-lg font-semibold text-k-dark-grey mt-1">
                  {summary.published_objectives}
                </p>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-sm text-k-medium-grey">
                Loading department OKRs…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-k-light-grey/40">
                      <th className="px-5 py-3 font-semibold text-k-dark-grey">
                        Key result
                      </th>
                      <th className="px-5 py-3 font-semibold text-k-dark-grey">
                        Department objective
                      </th>
                      <th className="px-5 py-3 font-semibold text-k-dark-grey">
                        Contributors
                      </th>
                      <th className="px-5 py-3 font-semibold text-k-dark-grey text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-5 py-10 text-center text-k-medium-grey"
                        >
                          No department key results for this department and
                          cycle. Create sub-KRs under each objective in Admin →
                          Department OKR planning so real IDs exist for
                          contributors.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-gray-50 last:border-0 hover:bg-k-light-grey/30 transition-colors"
                        >
                          <td className="px-5 py-4 font-medium text-k-dark-grey">
                            {row.krTitle}
                          </td>
                          <td className="px-5 py-4 text-k-medium-grey">
                            {row.objectiveTitle}
                          </td>
                          <td className="px-5 py-4">
                            {row.contributors.length === 0 ? (
                              <span className="text-k-medium-grey">None yet</span>
                            ) : (
                              <ul className="space-y-1.5">
                                {row.contributors.map((c, i) => (
                                  <li
                                    key={c.id || i}
                                    className="text-xs flex flex-wrap items-center justify-between gap-2"
                                  >
                                    <span className="font-medium text-k-dark-grey">
                                      {c.name}
                                    </span>
                                    <span className="flex items-center gap-2">
                                      {c.required ? (
                                        <OkrStatusBadge
                                          label="Required"
                                          tone="warning"
                                          size="xs"
                                        />
                                      ) : (
                                        <OkrStatusBadge
                                          label="Optional"
                                          tone="muted"
                                          size="xs"
                                        />
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          void handleToggleRequired(
                                            c.id,
                                            c.required,
                                          )
                                        }
                                      >
                                        {c.required
                                          ? "Make optional"
                                          : "Make required"}
                                      </Button>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={MdPersonAdd}
                              onClick={() => openAssign(row.id)}
                            >
                              Assign
                            </Button>
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

        <AssignContributorModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          krTitle={activeKr?.krTitle}
          employees={employees}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={setSelectedEmployeeId}
          required={required}
          onToggleRequired={setRequired}
          onSubmit={handleAssign}
          loading={assignLoading}
        />
      </div>
    </EmployeeLayout>
  );
}
