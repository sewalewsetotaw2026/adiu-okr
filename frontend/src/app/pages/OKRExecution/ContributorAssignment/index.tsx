import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import { routeConstants } from "../../../../utils/constants";
import {
  MdGroupAdd,
  MdPersonAdd,
  MdPerson,
  MdExpandMore,
  MdChevronRight,
  MdPeople,
} from "react-icons/md";
import AssignContributorModal from "../components/modals/AssignContributorModal";
import Button from "../../../components/Core/ui/Button";
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
    }[];
};

type SubordinateItem = {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  directReports: SubordinateItem[];
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
              c?.full_name ||
              c?.user?.employee?.full_name ||
              c?.user?.employee?.fullName ||
              c?.employee?.full_name ||
              c?.employee?.fullName ||
              (c?.user_id ? `User ${c.user_id}` : "Contributor"),
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
  const [expandedSubordinates, setExpandedSubordinates] = useState<Set<string>>(new Set());

  const [rows, setRows] = useState<KrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [_summary, setSummary] = useState<DepartmentContributorSummary | null>(
    null,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [activeKrId, setActiveKrId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | "">("");
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

  // Build immediate subordinate tree from `allSubordinates`.
  // Each direct report's own sub-reports are nested.
  const immediateSubordinates = useMemo<SubordinateItem[]>(() => {
    const all = allSubordinates;
    if (!all.length) return [];

    // Build a lookup: employee_user_id → raw record
    const byUserId = new Map<string, any>();
    all.forEach((s: any) => {
      const uid = String(s.employee_user_id ?? s.user_id ?? "");
      if (uid) byUserId.set(uid, s);
    });

    const currentUserIds = [
      String(user?.employee_id ?? ""),
      String(user?.id ?? ""),
    ].filter(Boolean);

    // Find direct reports (reports_to = current user's employee_id)
    const directReports = all.filter((s: any) => {
      const reportsTo = String(s.reports_to ?? s.manager_user_id ?? "");
      return reportsTo && currentUserIds.some((id) => id === reportsTo);
    });

    const toItem = (s: any): SubordinateItem => {
      const uid = String(s.employee_user_id ?? s.user_id ?? "");
      // Find their direct reports
      const subReports = all.filter((sub: any) => {
        const rt = String(sub.reports_to ?? sub.manager_user_id ?? "");
        return rt && rt === uid;
      });
      return {
        id: uid,
        name: s.employee_name ?? s.full_name ?? "Employee",
        jobTitle: s.job_title ?? s.position_name ?? "—",
        department: s.department_name ?? "—",
        directReports: subReports.map((sr: any) => toItem(sr)),
      };
    };

    return directReports.map((dr: any) => toItem(dr));
  }, [allSubordinates, user]);

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
          is_required_for_completion: true,
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



  return (
    <EmployeeLayout forceEmployeeSidebar>
      <div className="min-h-screen bg-linear-to-b from-slate-50 to-white -mx-4 md:-mx-8 px-4 md:px-8">
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


          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-sm text-k-medium-grey">
                Loading department OKRs…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-180 text-sm text-left">
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

        {/* Immediate Subordinates Section */}
        {immediateSubordinates.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-primary/10">
                <MdPeople className="text-primary text-xl" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Your Direct Reports</h2>
                <p className="text-xs text-slate-500">{immediateSubordinates.length} immediate team member{immediateSubordinates.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden divide-y divide-gray-50">
              {immediateSubordinates.map((sub) => (
                <div key={sub.id}>
                  {/* Direct report row */}
                  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                        <MdPerson className="text-primary text-base" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{sub.name}</p>
                        <p className="text-xs text-slate-500 truncate">{sub.jobTitle} · {sub.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {sub.directReports.length > 0 && (
                        <span className="text-[10px] font-bold text-primary/70 bg-primary/5 px-2 py-0.5 rounded-full">
                          {sub.directReports.length} sub-report{sub.directReports.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {sub.directReports.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSubordinates((prev) => {
                              const next = new Set(prev);
                              if (next.has(sub.id)) next.delete(sub.id);
                              else next.add(sub.id);
                              return next;
                            })
                          }
                          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary transition-colors cursor-pointer"
                        >
                          {expandedSubordinates.has(sub.id) ? (
                            <MdExpandMore className="text-base" />
                          ) : (
                            <MdChevronRight className="text-base" />
                          )}
                          {expandedSubordinates.has(sub.id) ? "Collapse" : "Expand"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-reports collapsible */}
                  {expandedSubordinates.has(sub.id) && sub.directReports.length > 0 && (
                    <div className="ml-14 border-l-2 border-primary/10 bg-slate-50/50">
                      {sub.directReports.map((sr) => (
                        <div
                          key={sr.id}
                          className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-100/60 last:border-0"
                        >
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 shrink-0">
                            <MdPerson className="text-slate-500 text-xs" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{sr.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{sr.jobTitle}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <AssignContributorModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          krTitle={activeKr?.krTitle}
          employees={employees}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={setSelectedEmployeeId}
          onSubmit={handleAssign}
          loading={assignLoading}
        />
      </div>
    </EmployeeLayout>
  );
}
