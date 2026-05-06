import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import EmployeeLayout from "../../../../components/DefaultLayout/EmployeeLayout";
import PageHeader from "../../../../components/common/PageHeader";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";

import RefreshButton from "../../../../components/common/RefreshButton";
import Button from "../../../../components/Core/ui/Button";
import KeyResultCard from "../../../../components/OKR/KeyResultCard";
import KRModal from "../components/KRModal";

import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  routeConstants,
  getRoleNameById,
} from "../../../../../utils/constants";

import {
  MdTrackChanges,
  MdAdd,
  MdChevronRight,
  MdOutlineHub,
} from "react-icons/md";
import { Status } from "../components/StatusBadge";
import StatusBadge from "../components/StatusBadge";

import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import toast from "react-hot-toast";

import { useDispatch, useSelector } from "react-redux";
import { selectAuthUser } from "../../../../slice/authSlice/selectors";
import { useDepartments } from "../../Departments/slice";
import type { Department } from "../../Departments/slice/types";
import { selectDepartments } from "../../Departments/slice/selectors";

function uniqNums(ids: number[]): number[] {
  return [...new Set(ids.filter((n) => !Number.isNaN(n) && n > 0))];
}

function collectDepartmentIdsFromKr(kr: Record<string, unknown>): number[] {
  const out: number[] = [];
  const add = (v: unknown) => {
    if (v == null || v === "") return;
    const n = Number(v);
    if (!Number.isNaN(n) && n > 0) out.push(n);
  };

  const listKeys = [
    "assignedDepartments",
    "assigned_departments",
    "departments",
    "department_assignments",
    "departmentAssignments",
  ] as const;

  const contributors = kr["contributors"];
  if (Array.isArray(contributors)) {
    for (const c of contributors) {
      if (c && typeof c === "object") {
        const emp = (c as any).user?.employee?.employments;
        if (Array.isArray(emp)) {
          for (const e of emp) {
            add(e.department_id);
          }
        }
      }
    }
  }
  console.log();

  for (const key of listKeys) {
    const list = kr[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === "number" || typeof item === "string") add(item);
      else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        add(o.id ?? o.department_id ?? o.departmentId);
        const dept = o.department;
        if (dept && typeof dept === "object")
          add((dept as Record<string, unknown>).id);
      }
    }
  }

  for (const key of [
    "department_objectives",
    "departmentObjectives",
  ] as const) {
    const arr = kr[key];
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      add(o.department_id ?? o.departmentId);
      const dept = o.department;
      if (dept && typeof dept === "object")
        add((dept as Record<string, unknown>).id);
    }
  }

  return uniqNums(out);
}

/* ================= TYPES ================= */
type KR = {
  id: number;
  title: string;
  description?: string;
  targetValue?: number;
  progress: number;
  currentValue?: number;
  weight: number;
  status: string;
  unitOfMeasure?: string;
  metricDefinitionId?: number;
  ownerDepartmentId?: number;
  assignedDepartmentIds: number[];
  contributesToScore?: boolean;
  contributesToValue?: boolean;
};

/* ================= COMPONENT ================= */
export default function ObjectiveDetail() {
  const { objectiveId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectAuthUser);

  const roleName = getRoleNameById(user?.role_id);
  const isAdminView = location.pathname.startsWith("/admin");
  const Layout =
    isAdminView && (roleName === "Admin" || roleName === "HR")
      ? AdminLayout
      : EmployeeLayout;

  const dispatch = useDispatch();
  const { actions } = useDepartments();

  const departments = useSelector(selectDepartments) as Department[];

  const [loading, setLoading] = useState(true);
  const [configMenu, setConfigMenu] = useState<any>(null);

  const [objective, setObjective] = useState<any>(null);
  const [krs, setKrs] = useState<KR[]>([]);
  const [showKRModal, setShowKRModal] = useState(false);
  const [editingKR, setEditingKR] = useState<KR | null>(null);
  const [deleteKRId, setDeleteKRId] = useState<number | null>(null);

  const departmentNameById = useMemo(() => {
    const m = new Map<number, string>();
    (departments || []).forEach((d) => m.set(d.id, d.name));
    return m;
  }, [departments]);

  /* ================= FETCH DEPARTMENTS ================= */
  useEffect(() => {
    dispatch(actions.fetchDepartmentsStart({ page: 1, limit: 100 }));
  }, [dispatch, actions]);

  /* ================= FETCH OBJECTIVE ================= */
  const fetchObjective = async () => {
    if (!objectiveId) return;

    try {
      setLoading(true);

      const configRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.configurationMenu,
        isSecureRoute: true,
      });
      setConfigMenu(configRes?.data?.data || configRes?.data || configRes);

      const targetRoute = isAdminView
        ? apiRoutes.okr.companyObjectiveById(objectiveId)
        : apiRoutes.okr.employeeObjectiveById(objectiveId);

      const res = await makeCall({
        method: "GET",
        route: targetRoute,
        isSecureRoute: true,
      });

      const data = res?.data?.data || res?.data;

      setObjective(data);

      setKrs(
        (data?.keyResults || []).map((kr: any) => ({
          id: Number(kr.id),
          title: kr.title,
          description: kr.description || "",
          targetValue: Number(kr.target_value) || 0,
          progress: (() => {
            const directRaw =
              kr.final_score ??
              kr.progress_percent ??
              kr.progress_pct ??
              kr.progress;
            if (directRaw !== null && directRaw !== undefined) {
              return Math.max(0, Math.min(100, Number(directRaw)));
            }

            const tgt = Number(kr.target_value ?? 0);
            const cur = Number(
              kr.current_value ?? kr.currentValue ?? kr.final_value ?? 0,
            );
            return tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
          })(),
          currentValue:
            kr.current_value ?? kr.currentValue ?? kr.final_value ?? 0,
          weight: Number(kr.weight_percent) || 0,
          status: (kr.status_code || kr.status || "").toString().toLowerCase(),
          unitOfMeasure:
            typeof kr.unit_of_measure === "string"
              ? kr.unit_of_measure
              : undefined,
          metricDefinitionId:
            kr.metric_definition_id != null
              ? Number(kr.metric_definition_id)
              : undefined,
          assignedDepartmentIds: collectDepartmentIdsFromKr(kr),
          contributors: kr.contributors || [],
          assignedEmployeeIds: (kr.contributors || []).map((c: any) => c.user_id).filter(Boolean),
          employeeNameById: new Map(
            (kr.contributors || [])
              .filter((c: any) => c.user_id && c.user?.employee?.full_name)
              .map((c: any) => [c.user_id, c.user.employee.full_name])
          ),
          contributesToScore: kr.contributes_to_objective_score !== false,
          contributesToValue: kr.contributes_to_objective_value !== false,
        })),
      );
    } catch (err) {
      console.error("FETCH OBJECTIVE ERROR", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObjective();
  }, [objectiveId]);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("createKR") === "true") {
      openAddModal();
      // Remove query param
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [loading]);

  /* ================= KR MODAL ================= */
  const openAddModal = () => {
    setEditingKR(null);
    setShowKRModal(true);
  };

  const openEditModal = (kr: any) => {
    setEditingKR(kr);
    setShowKRModal(true);
  };

  /* ================= DELETE KR ================= */
  const handleDeleteKR = async () => {
    if (deleteKRId === null) return;
    const deleteRoute = isAdminView
      ? apiRoutes.okr.companyKRById(deleteKRId)
      : apiRoutes.okr.employeeKRById(deleteKRId);
    try {
      await makeCall({
        method: "DELETE",
        route: deleteRoute,
        isSecureRoute: true,
      });
      toast.success("Key Result deleted successfully");
      setDeleteKRId(null);
      fetchObjective();
    } catch (err) {
      console.error("DELETE KR ERROR", err);
      toast.error("Failed to delete Key Result");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-16 space-y-8">
          <LoadingSkeleton variant="rectangular" height={100} />
          <div className="grid md:grid-cols-3 gap-6">
            <LoadingSkeleton variant="card" count={3} />
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <LoadingSkeleton variant="card" count={2} />
            </div>
            <div className="lg:col-span-1">
              <LoadingSkeleton variant="card" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!objective) {
    return (
      <Layout>
        <div className="text-center py-20 text-red-500">
          Objective not found
        </div>
      </Layout>
    );
  }

  const totalWeight = krs.reduce((sum, kr) => sum + kr.weight, 0);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          {/* NAV */}
          <nav className="flex flex-wrap items-center gap-3 text-sm pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  isAdminView
                    ? routeConstants.okr
                    : routeConstants.okrMyExecution,
                )
              }
              className="text-gray-500 hover:text-gray-800 transition-colors p-0 h-auto"
            >
              {isAdminView ? "OKR" : "Execution"}
            </Button>
            <MdChevronRight className="text-gray-300 shrink-0" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  isAdminView
                    ? routeConstants.okrObjectives
                    : routeConstants.okrMyExecution,
                )
              }
              className="text-gray-500 hover:text-gray-800 transition-colors p-0 h-auto"
            >
              {isAdminView ? "Objectives" : "My Execution"}
            </Button>
            <MdChevronRight className="text-gray-300 shrink-0" />
            <span className="text-gray-800 font-medium truncate max-w-[12rem] sm:max-w-none">
              {objective.title}
            </span>
          </nav>

          {/* HEADER */}
          <PageHeader>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3 text-white">
                <div className="rounded-xl bg-white/10 p-2 border border-white/10 shrink-0 shadow-inner">
                  <MdTrackChanges className="text-2xl" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tighter capitalize">
                    Objective Detail
                  </h1>
                  <div className="flex items-center gap-3 mt-2">
                    <StatusBadge status={objective.status_code as Status} />
                    <p className="text-white/60 text-[10px] font-black uppercase tracking-widest font-space">
                      Corporate Strategic Goal
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <RefreshButton onClick={fetchObjective} loading={loading} />
                {objective.status_code !== "published" && (
                  <Button
                    variant="white"
                    size="sm"
                    icon={MdAdd}
                    onClick={openAddModal}
                    disabled={
                      Number(
                        configMenu?.additional_configuration?.allowed_krs?.max,
                      ) > 0 &&
                      krs.length >=
                        Number(
                          configMenu?.additional_configuration?.allowed_krs
                            ?.max,
                        ) &&
                      !editingKR
                    }
                    className="uppercase tracking-widest font-space text-[10px] font-black"
                  >
                    {Number(
                      configMenu?.additional_configuration?.allowed_krs?.max,
                    ) > 0 &&
                    krs.length >=
                      Number(
                        configMenu?.additional_configuration?.allowed_krs?.max,
                      ) &&
                    !editingKR
                      ? "KR Limit Reached"
                      : "Add Key Result"}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <h3 className="text-white font-bold text-lg leading-tight tracking-tight capitalize">
                {objective.title}
              </h3>
              {objective.description && (
                <p className="mt-2 text-white/70 text-sm leading-relaxed max-w-3xl">
                  {objective.description}
                </p>
              )}
            </div>
          </PageHeader>

          {/* SUMMARY */}
          {(() => {
            const directRaw =
              objective.final_score ??
              objective.progress_percent ??
              objective.progress_pct ??
              objective.progress;
            let pct = 0;
            if (directRaw !== null && directRaw !== undefined) {
              pct = Math.max(0, Math.min(100, Number(directRaw)));
            } else {
              const tgt = Number(objective.target_value ?? 0);
              const cur = Number(objective.current_value ?? 0);
              pct = tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40 hover:border-primary/20 transition-all">
                  <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] font-space mb-1">
                    Key Results
                  </p>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter group-hover:scale-105 transition-transform origin-left">
                    {krs.length}
                  </p>
                </div>
                <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40 hover:border-primary/20 transition-all">
                  <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] font-space mb-1">
                    Total Weight
                  </p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">
                      {totalWeight}
                    </p>
                    <p className="text-xl font-black text-slate-300 tracking-tighter">
                      %
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${totalWeight > 100 ? "bg-red-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(totalWeight, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40 hover:border-primary/20 transition-all">
                  <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] font-space mb-1">
                    Overall Progress
                  </p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-4xl font-black text-primary tracking-tighter">
                      {pct}
                    </p>
                    <p className="text-xl font-black text-primary/30 tracking-tighter">
                      %
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-1000"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* MAIN */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <MdOutlineHub className="text-xl text-primary" />
                <h2 className="text-lg font-semibold tracking-tight capitalize">
                  Key Results
                </h2>
                <span className="text-sm text-gray-500">({krs.length})</span>
              </div>

              <div className="space-y-4">
                {krs.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white/50 px-8 py-20 text-center">
                    <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 mb-4">
                      <MdOutlineHub className="text-3xl text-slate-200" />
                    </div>
                    <p className="text-slate-900 font-bold uppercase tracking-widest font-space text-xs">
                      No Key Results Defined
                    </p>
                    <p className="text-[10px] text-slate-400 tracking-widest font-space mt-2 max-w-xs mx-auto leading-relaxed">
                      Measuring Performance Starts With Granular Key Results.
                      Add One To Begin Tracking.
                    </p>
                    {/* {objective.status_code !== "published" && (
                      <Button
                        onClick={openAddModal}
                        icon={MdAdd}
                        className="mt-8 rounded-xl bg-slate-900 px-6 py-3 text-[10px] font-black text-white tracking-widest font-space hover:bg-slate-800 transition shadow-xl shadow-slate-200"
                      >
                        Define Key Result
                      </Button>
                    )} */}
                  </div>
                ) : (
                  krs.map((kr) => (
                    <KeyResultCard
                      key={kr.id}
                      kr={{
                        ...kr,
                        departmentNameById,
                      }}
                      variant="admin"
                      onEdit={openEditModal}
                      onDelete={(k) => setDeleteKRId(k.id)}
                      isReadOnly={objective?.status_code === "published"}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KR CREATE / EDIT */}
      <KRModal
        isOpen={showKRModal}
        onClose={() => {
          setShowKRModal(false);
          setEditingKR(null);
        }}
        objectiveId={objectiveId!}
        editingKR={editingKR}
        assignmentType={isAdminView ? "company" : "employee"}
        onSuccess={fetchObjective}
      />

      {/* DELETE KR CONFIRMATION */}
      <ConfirmationModal
        isOpen={deleteKRId !== null}
        onClose={() => setDeleteKRId(null)}
        onConfirm={handleDeleteKR}
        title="Delete Key Result"
        message="Are you sure you want to delete this Key Result? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />
    </Layout>
  );
}
