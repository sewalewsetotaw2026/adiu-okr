import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import BulletText from "../../../../components/common/BulletText";
import BulletTextarea from "../../../../components/common/BulletTextarea";

import ActivityTimeline from "../components/ActivityTimeline";
import ModalLayout from "../components/ModalLayout";
import ApprovalFooter from "../components/ApprovalFooter";
import RefreshButton from "../../../../components/common/RefreshButton";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";

import { useParams, useNavigate } from "react-router-dom";
import { routeConstants } from "../../../../../utils/constants";

import {
  MdTrackChanges,
  MdAdd,
  MdChevronRight,
  MdPublish,
  MdOutlineHub,
  MdGroups,
} from "react-icons/md";
import { Status } from "../components/StatusBadge";
import StatusBadge from "../components/StatusBadge";

import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import toast from "react-hot-toast";

import { useDispatch, useSelector } from "react-redux";
import { useDepartments } from "../../Departments/slice";
import type { Department } from "../../Departments/slice/types";
import { selectDepartments } from "../../Departments/slice/selectors";

/* ================= UTIL ================= */
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
  description: string;
  targetValue: number;
  progress: number;
  currentValue?: number;
  weight: number;
  status?: string;
  unitOfMeasure?: string;
  metricDefinitionId?: number;
  ownerDepartmentId?: number;
  assignedDepartmentIds: number[];
};

type MetricDefinitionOption = {
  id: number;
  name: string;
  unit_of_measure?: string;
};

/* ================= COMPONENT ================= */
export default function ObjectiveDetail() {
  const { objectiveId } = useParams();
  const navigate = useNavigate();

  const dispatch = useDispatch();
  const { actions } = useDepartments();

  const departments = useSelector(selectDepartments) as Department[];

  const [loading, setLoading] = useState(true);

  const [objective, setObjective] = useState<any>(null);
  const [krs, setKrs] = useState<KR[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const [metricDefinitions, setMetricDefinitions] = useState<
    MetricDefinitionOption[]
  >([]);

  const [showKRModal, setShowKRModal] = useState(false);
  const [krSubmitting, setKrSubmitting] = useState(false);
  const [editingKR, setEditingKR] = useState<KR | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    weight: "",
    targetValue: "",
    unitOfMeasure: "",
    metricDefinitionId: "",
    assignedDepartmentIds: [] as number[],
  });

  const [deptSearch, setDeptSearch] = useState("");

  const departmentNameById = useMemo(() => {
    const m = new Map<number, string>();
    (departments || []).forEach((d) => m.set(d.id, d.name));
    return m;
  }, [departments]);

  /* ================= FETCH DEPARTMENTS ================= */
  useEffect(() => {
    dispatch(actions.fetchDepartmentsStart({ page: 1, limit: 100 }));
  }, [dispatch, actions]);

  /* ================= FETCH METRIC DEFINITIONS ================= */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await makeCall({
          method: "GET",
          route: apiRoutes.okr.companyMetrics,
          isSecureRoute: true,
        });
        const data = res?.data?.data ?? res?.data ?? [];
        const list = Array.isArray(data) ? data : (data?.metrics ?? data?.rows);
        const rows = Array.isArray(list) ? list : [];
        const normalized: MetricDefinitionOption[] = rows
          .map((m: any) => ({
            id: Number(m.id),
            name:
              String(
                m.name ?? m.title ?? m.metric_name ?? m.code ?? "",
              ).trim() || `Metric #${m.id}`,
            unit_of_measure:
              typeof m.unit_of_measure === "string"
                ? m.unit_of_measure
                : undefined,
          }))
          .filter((m) => Number.isFinite(m.id));
        if (!cancelled) setMetricDefinitions(normalized);
      } catch (e) {
        console.error("LOAD METRIC DEFINITIONS", e);
        if (!cancelled) setMetricDefinitions([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ================= FETCH OBJECTIVE ================= */
  const fetchObjective = async () => {
    if (!objectiveId) return;

    try {
      setLoading(true);

      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.companyObjectiveById(objectiveId),
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
        })),
      );

      setActivities(
        (data?.activityLog || []).map((a: any) => ({
          id: String(a.id),
          title: a.description,
          time: new Date(a.created_at).toLocaleString(),
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

  /* ================= KR MODAL ================= */
  const openAddModal = () => {
    setEditingKR(null);
    setForm({
      title: "",
      description: "",
      weight: "",
      targetValue: "",
      unitOfMeasure: "",
      metricDefinitionId: "",
      assignedDepartmentIds: [],
    });
    setShowKRModal(true);
  };

  const openEditModal = (kr: KR) => {
    setEditingKR(kr);
    setForm({
      title: kr.title,
      description: kr.description,
      weight: String(kr.weight),
      targetValue: String(kr.targetValue),
      unitOfMeasure: kr.unitOfMeasure ?? "",
      metricDefinitionId:
        kr.metricDefinitionId != null ? String(kr.metricDefinitionId) : "",
      assignedDepartmentIds: kr.assignedDepartmentIds,
    });
    setShowKRModal(true);
  };

  /* ================= SAVE KR ================= */
  const handleSaveKR = async () => {
    if (!objectiveId) return;

    const metricId = Number(form.metricDefinitionId);
    const unit = form.unitOfMeasure.trim();
    const departmentsToAssign = uniqNums([
      ...(Array.isArray(form.assignedDepartmentIds)
        ? form.assignedDepartmentIds
        : []),
    ]);

    if (
      !form.title ||
      !form.weight ||
      !form.targetValue ||
      !Number.isFinite(metricId) ||
      metricId <= 0 ||
      !unit
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    const newWeight = Number(form.weight);

    setKrSubmitting(true);
    try {
      if (editingKR) {
        const krId = Number(editingKR.id);

        await makeCall({
          method: "PUT",
          route: apiRoutes.okr.companyKRById(krId),
          body: {
            title: form.title,
            description: form.description,
            metric_definition_id: metricId,
            unit_of_measure: unit,
            target_value: Number(form.targetValue),
            weight_percent: newWeight,
            assign_department_ids: departmentsToAssign,
          },
          isSecureRoute: true,
        });
      } else {
        await makeCall({
          method: "POST",
          route: `${apiRoutes.okr.companyObjectives}/${objectiveId}/key-results`,
          body: {
            title: form.title,
            description: form.description,
            metric_definition_id: metricId,
            unit_of_measure: unit,
            target_value: Number(form.targetValue),
            weight_percent: newWeight,
            contributes_to_score: true,
            contributes_to_value: true,
            assign_department_ids: departmentsToAssign,
          },
          isSecureRoute: true,
        });
      }

      await fetchObjective();

      setShowKRModal(false);
      setEditingKR(null);
      toast.success(editingKR ? "Key result updated" : "Key result created");
      setForm({
        title: "",
        description: "",
        weight: "",
        targetValue: "",
        unitOfMeasure: "",
        metricDefinitionId: "",
        assignedDepartmentIds: [],
      });
    } catch (err) {
      console.error("KR SAVE ERROR", err);
      const msg =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "Could not save key result. Please try again.";
      toast.error(msg);
    } finally {
      setKrSubmitting(false);
    }
  };

  /* ================= PUBLISH KR ================= */
  const publishKR = async (krId: number) => {
    if (!krId) return;
    try {
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.publishCompanyKR(krId),
        isSecureRoute: true,
      });
      await fetchObjective();
      toast.success("Key result published.");
    } catch (err: any) {
      console.error("PUBLISH KR ERROR", err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to publish key result.",
      );
    }
  };

  if (loading) {
    return (
      <AdminLayout>
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
      </AdminLayout>
    );
  }

  if (!objective) {
    return (
      <AdminLayout>
        <div className="text-center py-20 text-red-500">
          Objective not found
        </div>
      </AdminLayout>
    );
  }

  const totalWeight = krs.reduce((sum, kr) => sum + kr.weight, 0);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          {/* NAV */}
          <nav className="flex flex-wrap items-center gap-3 text-sm pt-4">
            <button
              type="button"
              onClick={() => navigate(routeConstants.okr)}
              className="text-gray-500 hover:text-gray-800 transition-colors"
            >
              OKR
            </button>
            <MdChevronRight className="text-gray-300 shrink-0" />
            <button
              type="button"
              onClick={() => navigate(routeConstants.okrObjectives)}
              className="text-gray-500 hover:text-gray-800 transition-colors"
            >
              Objectives
            </button>
            <MdChevronRight className="text-gray-300 shrink-0" />
            <span className="text-gray-800 font-medium truncate max-w-[12rem] sm:max-w-none">
              {objective.title}
            </span>
          </nav>

          {/* HEADER */}
          <PageHeader>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3 text-white">
                  <div className="rounded-xl bg-white/10 p-2 border border-white/10 shrink-0">
                    <MdTrackChanges className="text-2xl" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">
                      Objective Detail
                    </h1>
                    <div className="flex items-center gap-3 mt-2">
                      <StatusBadge status={objective.status_code as Status} />
                      <p className="text-white/60 text-[10px] font-black tracking-widest font-space">
                        Corporate Strategic Goal
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <RefreshButton
                    onClick={fetchObjective}
                    loading={loading}
                    className="bg-white/10 ring-white/20 text-white hover:bg-white/20 shadow-xl shadow-black/10"
                  />
                  {objective.status_code !== "published" && (
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[10px] font-black text-slate-900 tracking-widest font-space shadow-xl shadow-black/10 hover:bg-slate-50 transition"
                    >
                      <MdAdd className="text-lg" />
                      Add Key Result
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <h3 className="text-white font-bold text-lg leading-tight tracking-tight">
                  {objective.title}
                </h3>
                {objective.description && (
                  <p className="mt-2 text-white/70 text-sm leading-relaxed max-w-3xl">
                    {objective.description}
                  </p>
                )}
              </div>
            </div>
          </PageHeader>

          {/* SUMMARY */}
          {(() => {
            const tgt = Number(objective.target_value ?? 0);
            const cur = Number(objective.current_value ?? 0);
            const pct = tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
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
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <MdOutlineHub className="text-xl text-primary" />
                <h2 className="text-lg font-semibold tracking-tight">
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
                    {objective.status_code !== "published" && (
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-[10px] font-black text-white tracking-widest font-space hover:bg-slate-800 transition shadow-xl shadow-slate-200"
                      >
                        <MdAdd className="text-base" />
                        Define Key Result
                      </button>
                    )}
                  </div>
                ) : (
                  krs.map((kr) => {
                    const krCur = kr.currentValue ?? 0;
                    const krTgt = kr.targetValue ?? 0;
                    const krPct =
                      krTgt > 0
                        ? Number(((krCur / krTgt) * 100).toFixed(2))
                        : 0;

                    return (
                      <article
                        key={kr.id}
                        className="group relative overflow-hidden rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-200/40 transition-all hover:border-primary/20"
                      >
                        <div className="absolute left-0 top-0 h-full w-1.5 bg-primary/10 group-hover:bg-primary transition-colors" />
                        <div className="pl-8 pr-6 py-6">
                          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-3">
                                <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-primary transition-colors">
                                  {kr.title}
                                </h3>
                                <StatusBadge
                                  status={
                                    kr.status === "published"
                                      ? "published"
                                      : "draft"
                                  }
                                />
                              </div>
                              {kr.description && (
                                <div className="mt-2 text-slate-500 text-sm leading-relaxed max-w-2xl">
                                  <BulletText text={kr.description} />
                                </div>
                              )}
                            </div>

                            <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end">
                              {objective.status_code !== "published" && (
                                <>
                                  {kr.status !== "published" && (
                                    <button
                                      type="button"
                                      onClick={() => void publishKR(kr.id)}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black tracking-widest font-space border border-emerald-100 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5"
                                    >
                                      <MdPublish />
                                      Publish
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(kr)}
                                    className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-[10px] font-black tracking-widest font-space border border-slate-100 hover:bg-slate-100 transition-colors"
                                  >
                                    Edit
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Assignments */}
                          <div className="mt-8 grid lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <p className="text-[10px] font-black text-slate-400 tracking-widest font-space">
                                Assigned Departments
                              </p>
                              {kr.assignedDepartmentIds.length === 0 ? (
                                <p className="text-[10px] text-slate-300 italic font-space tracking-widest">
                                  Unassigned
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {kr.assignedDepartmentIds.map((deptId) => (
                                    <div
                                      key={deptId}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg"
                                    >
                                      <MdGroups className="text-slate-400" />
                                      <span className="text-[10px] font-black text-slate-600 tracking-widest font-space">
                                        {departmentNameById.get(deptId) ??
                                          `Dept ${deptId}`}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-center">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-slate-500 tracking-widest font-space">
                                  Achievement Progress
                                </span>
                                <span className="text-sm font-black text-primary font-space tracking-tighter">
                                  {krPct}%
                                </span>
                              </div>
                              <div className="h-2 w-full bg-white border border-slate-200 rounded-full overflow-hidden shadow-inner">
                                <div
                                  className="h-full bg-primary transition-all duration-1000 ease-out"
                                  style={{ width: `${Math.min(100, krPct)}%` }}
                                />
                              </div>
                              <div className="mt-3 flex justify-between text-[10px] font-black text-slate-400 tracking-widest font-space">
                                <span>
                                  {kr.currentValue ?? 0} {kr.unitOfMeasure}
                                </span>
                                <span>
                                  Target: {kr.targetValue} {kr.unitOfMeasure}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 tracking-widest font-space">
                                  Weighting
                                </span>
                                <span className="text-xs font-black text-slate-900 font-space tracking-widest">
                                  {kr.weight}% Contribution
                                </span>
                              </div>
                            </div>
                            {/*<div className="text-[10px] font-black text-slate-300 tracking-widest font-space italic">
                              ID: KR-{String(kr.id).padStart(4, "0")}
                            </div>*/}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            <aside className="lg:pt-10">
              {/*<ActivityTimeline items={activities} />*/}
            </aside>
          </div>
        </div>
      </div>

      {/* KR CREATE / EDIT */}
      <ModalLayout
        isOpen={showKRModal}
        onClose={() => {
          setShowKRModal(false);
          setEditingKR(null);
        }}
        title={editingKR ? "Edit Key Result" : "New Key Result"}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Title
            </label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="Measurable Outcome"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Description
            </label>
            <BulletTextarea
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[88px] resize-y"
              value={form.description}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, description: value }))
              }
              placeholder="Optional Context"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Metric Definition
              </label>
              <select
                value={form.metricDefinitionId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, metricDefinitionId: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none bg-white"
              >
                <option value="">Select A Metric...</option>
                {metricDefinitions.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Unit of Measure
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                value={form.unitOfMeasure}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unitOfMeasure: e.target.value }))
                }
                placeholder="e.g. ETB, %, count"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Weight (%)
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                value={form.weight}
                onChange={(e) =>
                  setForm((f) => ({ ...f, weight: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Target Value
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                value={form.targetValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetValue: e.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Assigned Owner Departments
            </label>
            <div className="mb-2">
              <input
                type="text"
                placeholder="Search departments..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/25"
              />
            </div>
            <div className="max-h-40 overflow-auto rounded-xl border border-gray-200 p-3 space-y-2 bg-white">
              {(departments || []).filter(d => 
                d.name.toLowerCase().includes(deptSearch.toLowerCase()) || 
                d.department_code?.toLowerCase().includes(deptSearch.toLowerCase())
              ).length === 0 ? (
                <p className="text-xs text-gray-500">
                  No matching departments.
                </p>
              ) : (
                (departments || []).filter(d => 
                  d.name.toLowerCase().includes(deptSearch.toLowerCase()) || 
                  d.department_code?.toLowerCase().includes(deptSearch.toLowerCase())
                ).map((d) => {
                  const deptId = Number(d.id);
                  const checked = form.assignedDepartmentIds.includes(deptId);
                  return (
                    <label
                      key={d.id}
                      className="flex items-center gap-2 text-xs text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            assignedDepartmentIds: e.target.checked
                              ? uniqNums([...f.assignedDepartmentIds, deptId])
                              : f.assignedDepartmentIds.filter(
                                  (id) => id !== deptId,
                                ),
                          }));
                        }}
                      />
                      <span>
                        {d.name}
                        {d.department_code ? ` (${d.department_code})` : ""}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <ApprovalFooter
          onCancel={() => {
            setShowKRModal(false);
            setEditingKR(null);
          }}
          onConfirm={() => void handleSaveKR()}
          confirmText={
            krSubmitting ? "Saving..." : editingKR ? "Save Changes" : "Create"
          }
          confirmDisabled={krSubmitting || !form.title.trim()}
        />
      </ModalLayout>
    </AdminLayout>
  );
}
