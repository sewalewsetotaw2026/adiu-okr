import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import BulletTextarea from "../../../../components/common/BulletTextarea";
import ObjectiveCard from "../../../../components/common/ObjectiveCard";
import KeyResultListItem from "../../../../components/common/KeyResultListItem";
import ModalLayout from "../components/ModalLayout";
import ApprovalFooter from "../components/ApprovalFooter";

import {
  MdTrackChanges,
  MdAdd,
  MdPublish,
  MdEdit,
  MdTrendingUp,
  MdOutlineHub,
  MdOutlineVisibility,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { routeConstants } from "../../../../../utils/constants";
import { Status } from "../components/StatusBadge";

import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import ToastService from "../../../../../utils/ToastService";

/* ================= TYPES ================= */
type Objective = {
  id: number;
  title: string;
  description: string;
  status: Status;
  krCount: number;
  progress: number;
  keyResults: any[];
};

/* ================= COMPONENT ================= */
export default function CompanyObjectives() {
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState("Loading...");
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentCycleId, setCurrentCycleId] = useState<number | null>(null);

  const [editingObjective, setEditingObjective] = useState<Objective | null>(
    null,
  );

  const [form, setForm] = useState({
    title: "",
    description: "",
  });

  const summary = useMemo(() => {
    const n = objectives.length;
    const published = objectives.filter((o) => o.status === "published").length;
    const draft = n - published;
    const totalKRs = objectives.reduce((s, o) => s + o.krCount, 0);
    const avgProgress =
      n > 0
        ? Math.round(objectives.reduce((s, o) => s + o.progress, 0) / n)
        : 0;
    return { n, published, draft, totalKRs, avgProgress };
  }, [objectives]);

  const hasDraftObjectives = summary.draft > 0;

  /* ================= FETCH OBJECTIVES ================= */
  const fetchObjectives = async (cycleId: number) => {
    const res = await makeCall({
      method: "GET",
      route: `${apiRoutes.okr.companyObjectives}?cycle_id=${cycleId}`,
      isSecureRoute: true,
    });

    const list = res?.data?.data || res?.data || [];

    setObjectives(
      (Array.isArray(list) ? list : []).map((o: any) => {
        const tgt = Number(o.target_value ?? 0);
        const cur = Number(o.current_value ?? 0);
        const pct = tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
        return {
          id: Number(o.id),
          title: o.title || "Untitled",
          description: o.description || "",
          status: o.status_code || "draft",
          krCount: o._count?.keyResults || 0,
          progress: pct,
          keyResults: Array.isArray(o.keyResults) ? o.keyResults : [],
        };
      }),
    );
  };

  /* ================= INIT ================= */
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);

        const cycleRes = await makeCall({
          method: "GET",
          route: apiRoutes.okr.currentCycle,
          isSecureRoute: true,
        });

        const cycle = cycleRes?.data?.data || cycleRes?.data || cycleRes;

        if (!cycle?.id) return;

        setCurrentCycleId(cycle.id);
        setSelectedCycle(cycle.name || "Current Cycle");

        await fetchObjectives(cycle.id);
      } catch (err) {
        console.error("INIT ERROR", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  /* ================= CREATE / UPDATE ================= */
  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    if (!currentCycleId) return;

    setSubmitting(true);
    try {
      if (editingObjective) {
        await makeCall({
          method: "PUT",
          route: `${apiRoutes.okr.companyObjectives}/${editingObjective.id}`,
          body: {
            title: form.title,
            description: form.description,
            target_value: 1000,
          },
          isSecureRoute: true,
        });
      } else {
        await makeCall({
          method: "POST",
          route: apiRoutes.okr.companyObjectives,
          body: {
            title: form.title,
            description: form.description,
            cycle_id: currentCycleId,
            metric_definition_id: 1,
            unit_of_measure: "ETB",
            target_value: 1000,
          },
          isSecureRoute: true,
        });
      }

      await fetchObjectives(currentCycleId);

      setIsModalOpen(false);
      setEditingObjective(null);
      ToastService.success(
        editingObjective ? "Objective updated" : "Objective created",
      );
    } catch (err: any) {
      console.error("SUBMIT ERROR", err);
      ToastService.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save objective",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ================= PUBLISH ================= */
  const publishObjectiveKRsIfNeeded = async (objectiveId: number) => {
    const detailRes = await makeCall({
      method: "GET",
      route: apiRoutes.okr.companyObjectiveById(objectiveId),
      isSecureRoute: true,
    });
    const detail = detailRes?.data?.data ?? detailRes?.data ?? null;
    const krs = Array.isArray(detail?.keyResults) ? detail.keyResults : [];
    const draftKrIds = krs
      .filter(
        (kr: any) => (kr?.status_code || kr?.status || "draft") !== "published",
      )
      .map((kr: any) => Number(kr.id))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    if (draftKrIds.length === 0) return { published: 0, total: krs.length };

    const results = await Promise.allSettled(
      draftKrIds.map((id: number) =>
        makeCall({
          method: "PATCH",
          route: apiRoutes.okr.publishCompanyKR(id),
          isSecureRoute: true,
        }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      throw new Error(
        `${failed} key result(s) failed to publish. Fix validation and try again.`,
      );
    }
    return { published: draftKrIds.length, total: krs.length };
  };

  const handlePublish = async () => {
    if (!currentCycleId) return;

    try {
      // Ensure KRs are published before bulk objective publish
      const draftObjectives = objectives.filter(
        (o) => o.status !== "published",
      );
      if (draftObjectives.length > 0) {
        for (const obj of draftObjectives) {
          if (obj.krCount > 0) {
            await publishObjectiveKRsIfNeeded(obj.id);
          }
        }
      }

      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.publishCompanyObjectives,
        body: {
          cycle_id: currentCycleId,
        },
        isSecureRoute: true,
      });

      await fetchObjectives(currentCycleId);
      ToastService.success("Company planning published for this cycle.");
    } catch (err: any) {
      console.error("PUBLISH ERROR", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to publish planning.";
      ToastService.error(msg);
    }
  };

  const publishSingleObjective = async (objectiveId: number) => {
    if (!objectiveId) return;
    try {
      const obj = objectives.find((o) => o.id === objectiveId);
      if (!obj?.krCount) {
        ToastService.error("Add at least one key result before publishing.");
        return;
      }

      await publishObjectiveKRsIfNeeded(objectiveId);
      await makeCall({
        method: "PATCH",
        route: apiRoutes.okr.publishCompanyObjective(objectiveId),
        isSecureRoute: true,
      });
      if (currentCycleId) await fetchObjectives(currentCycleId);
      ToastService.success("Objective published.");
    } catch (err: any) {
      console.error("PUBLISH SINGLE OBJECTIVE ERROR", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to publish objective.";
      ToastService.error(msg);
    }
  };

  const openCreateModal = () => {
    setEditingObjective(null);
    setForm({ title: "", description: "" });
    setIsModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          <PageHeader>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner">
                    <MdTrackChanges className="text-3xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tighter text-white">
                      Company Strategy
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 ring-1 ring-white/20 text-[10px] font-black tracking-widest text-white/70 font-space">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {selectedCycle}
                      </div>
                      <p className="text-white/60 text-xs font-medium">
                        {summary.n} Active Objectives · {summary.avgProgress}%
                        Overall Progress
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <RefreshButton
                    onClick={async () => {
                      if (currentCycleId) {
                        setLoading(true);
                        try {
                          await fetchObjectives(currentCycleId);
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    loading={loading}
                  />
                  {hasDraftObjectives && (
                    <button
                      type="button"
                      onClick={handlePublish}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-900 text-primary tracking-widest font-space shadow-lg shadow-slate-20/50 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                      <MdPublish className="text-lg" />
                      Publish Planning
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-900 tracking-widest font-space shadow-lg shadow-slate-20/50 hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    <MdAdd className="text-lg" />
                    New Objective
                  </button>
                </div>
              </div>
            </div>
          </PageHeader>

          {loading ? (
            <div className="animate-pulse space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-24 rounded-2xl bg-gray-200/80 ring-1 ring-gray-100"
                  />
                ))}
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-64 rounded-2xl bg-gray-100 ring-1 ring-gray-100"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Strategic Goals",
                    value: summary.n,
                    icon: MdTrackChanges,
                    color: "text-primary",
                  },
                  {
                    label: "Active Key Results",
                    value: summary.totalKRs,
                    icon: MdOutlineHub,
                    color: "text-emerald-500",
                  },
                  {
                    label: "Strategy Progress",
                    value: `${summary.avgProgress}%`,
                    icon: MdTrendingUp,
                    color: "text-blue-500",
                    progress: summary.avgProgress,
                  },
                  {
                    label: "Planning Status",
                    value: hasDraftObjectives ? "In Draft" : "Published",
                    icon: MdOutlineVisibility,
                    color: hasDraftObjectives
                      ? "text-amber-500"
                      : "text-emerald-500",
                  },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-xl shadow-slate-200/40 ring-1 ring-slate-100 transition-all hover:shadow-2xl hover:shadow-slate-300/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-black tracking-widest text-slate-400 font-space mb-1">
                          {stat.label}
                        </p>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">
                          {stat.value}
                        </h3>
                      </div>
                      <stat.icon
                        className={`text-2xl ${stat.color} opacity-20 group-hover:opacity-100 transition-opacity`}
                      />
                    </div>
                    {stat.progress !== undefined && (
                      <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-1000"
                          style={{ width: `${stat.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {objectives.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-8 py-16 text-center">
                  <MdTrackChanges className="mx-auto text-4xl text-gray-300 mb-3" />
                  <p className="text-gray-700 font-medium">
                    No objectives in this cycle yet
                  </p>
                  <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                    Create your first company objective, then add key results
                    and assign owning departments from the detail view.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-95"
                  >
                    <MdAdd />
                    Create Objective
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {objectives.map((obj) => (
                    <ObjectiveCard
                      key={obj.id}
                      id={`CO-${obj.id}`}
                      title={obj.title}
                      status={obj.status}
                      progress={obj.progress}
                      progressLabel="Overall Progress"
                      krsCount={obj.krCount}
                      headerContext={obj.description}
                      expandable={obj.keyResults?.length > 0}
                      defaultExpanded={false}
                      onClick={() =>
                        navigate(
                          routeConstants.okrObjectiveDetail.replace(
                            ":objectiveId",
                            String(obj.id),
                          ),
                        )
                      }
                      actions={
                        <>
                          <div className="flex flex-wrap gap-2 flex-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  routeConstants.okrObjectiveDetail.replace(
                                    ":objectiveId",
                                    String(obj.id),
                                  ),
                                );
                              }}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              View Details
                            </button>
                            {/*<button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  routeConstants.okrObjectiveDetail.replace(
                                    ":objectiveId",
                                    String(obj.id),
                                  ) + "?createKR=true",
                                );
                              }}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                            >
                              + Add KR
                            </button>*/}
                          </div>
                          {obj.status !== "published" && (
                            <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                              {obj.krCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void publishSingleObjective(obj.id);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 tracking-widest font-space"
                                >
                                  <MdPublish className="text-sm" />
                                  Publish
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingObjective(obj);
                                  setForm({
                                    title: obj.title,
                                    description: obj.description,
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-800 tracking-widest font-space"
                              >
                                <MdEdit className="text-sm" />
                                Edit
                              </button>
                            </div>
                          )}
                        </>
                      }
                    >
                      {obj.keyResults?.length > 0 && (
                        <div className="flex flex-col gap-4 mt-2">
                          {obj.keyResults.map((kr: any) => {
                            const krTgt = Number(kr.target_value ?? 0);
                            const krCur = Number(
                              kr.current_value ??
                                kr.currentValue ??
                                kr.final_value ??
                                0,
                            );
                            const krPct =
                              krTgt > 0
                                ? Number(((krCur / krTgt) * 100).toFixed(2))
                                : 0;
                            return (
                              <KeyResultListItem
                                key={kr.id}
                                title={kr.title}
                                progress={krPct}
                                status={kr.status_code || "draft"}
                                targetString={`${kr.unit_of_measure === "ETB" ? "ETB " : ""}${krCur} / ${krTgt}${kr.unit_of_measure === "%" ? "%" : ""}`}
                                metricTypeString={`Weight: ${Math.round(kr.weight_percent ?? 0)}%`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </ObjectiveCard>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ModalLayout
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingObjective(null);
        }}
        title={editingObjective ? "Edit Objective" : "New Objective"}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Title
            </label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
              placeholder="Short, outcome-focused title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Description
            </label>
            <BulletTextarea
              className="min-h-[100px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
              placeholder="Context and success criteria (optional)"
              value={form.description}
              onValueChange={(value) =>
                setForm({ ...form, description: value })
              }
            />
          </div>
        </div>
        <ApprovalFooter
          onCancel={() => {
            setIsModalOpen(false);
            setEditingObjective(null);
          }}
          onConfirm={() => void handleSubmit()}
          confirmText={
            submitting
              ? "Saving..."
              : editingObjective
                ? "Save Changes"
                : "Create"
          }
          confirmDisabled={submitting || !form.title.trim()}
        />
      </ModalLayout>
    </AdminLayout>
  );
}
