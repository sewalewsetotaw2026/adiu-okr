import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import Button from "../../../../components/Core/ui/Button";
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
  indirectProgress?: number;
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
  const [configMenu, setConfigMenu] = useState<any>(null);

  const [editingObjective, setEditingObjective] = useState<Objective | null>(
    null,
  );

  const [form, setForm] = useState({
    title: "",
    description: "",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const filteredObjectives = useMemo(() => {
    return objectives.filter((obj) => {
      const matchesSearch = obj.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || obj.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [objectives, searchTerm, statusFilter]);

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
        const directRaw =
          o.final_score ?? o.progress_percent ?? o.progress_pct ?? o.progress;
        let pct = 0;
        if (directRaw !== null && directRaw !== undefined) {
          pct = Math.max(0, Math.min(100, Number(directRaw)));
        } else {
          const tgt = Number(o.target_value ?? 0);
          const cur = Number(o.current_value ?? 0);
          pct = tgt > 0 ? Number(((cur / tgt) * 100).toFixed(2)) : 0;
        }
        const indirectPct = Number(o.indirect_score ?? 0);
        return {
          id: Number(o.id),
          title: o.title || "Untitled",
          description: o.description || "",
          status: o.status_code || "draft",
          krCount: o._count?.keyResults || 0,
          progress: pct,
          indirectProgress: indirectPct,
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
        setSelectedCycle(cycle.title || cycle.name || "Active Cycle");

        const configRes = await makeCall({
          method: "GET",
          route: apiRoutes.okr.configurationMenu,
          isSecureRoute: true,
        });
        setConfigMenu(configRes?.data?.data || configRes?.data || configRes);

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
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4 text-white">
                <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner shrink-0">
                  <MdTrackChanges className="text-3xl" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tighter capitalize">
                    Company Strategy
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 ring-1 ring-white/20 text-[10px] font-black uppercase tracking-widest text-white/70 font-space">
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

              <div className="flex flex-wrap gap-2 lg:justify-end items-center">
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
                  <Button
                    variant="white"
                    size="sm"
                    icon={MdPublish}
                    onClick={handlePublish}
                    className="tracking-widest font-space text-[10px] font-black"
                  >
                    Publish Planning
                  </Button>
                )}
                <Button
                  variant="white"
                  size="sm"
                  icon={MdAdd}
                  onClick={openCreateModal}
                  disabled={
                    Number(
                      configMenu?.additional_configuration?.allowed_objectives
                        ?.max,
                    ) > 0 &&
                    summary.n >=
                      Number(
                        configMenu?.additional_configuration?.allowed_objectives
                          ?.max,
                      )
                  }
                  className="tracking-widest font-space text-[10px] font-black"
                >
                  {Number(
                    configMenu?.additional_configuration?.allowed_objectives
                      ?.max,
                  ) > 0 &&
                  summary.n >=
                    Number(
                      configMenu?.additional_configuration?.allowed_objectives
                        ?.max,
                    )
                    ? "Objective Limit Reached"
                    : "New Objective"}
                </Button>
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
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter capitalize">
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

              {/* Search & Filter Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MdOutlineVisibility className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search strategic objectives..."
                    className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-space mr-2">
                    Status:
                  </span>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {["all", "draft", "published"].map((s) => (
                      <Button
                        key={s}
                        variant={statusFilter === s ? "white" : "ghost"}
                        size="sm"
                        onClick={() => setStatusFilter(s)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest font-space transition-all h-auto ${
                          statusFilter === s
                            ? "bg-white text-primary shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
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
                  <Button
                    variant="primary"
                    size="sm"
                    icon={MdAdd}
                    onClick={openCreateModal}
                    disabled={
                      Number(
                        configMenu?.additional_configuration?.allowed_objectives
                          ?.max,
                      ) > 0 &&
                      summary.n >=
                        Number(
                          configMenu?.additional_configuration
                            ?.allowed_objectives?.max,
                        )
                    }
                    className="mt-6 inline-flex items-center gap-2 rounded-xl"
                  >
                    {Number(
                      configMenu?.additional_configuration?.allowed_objectives
                        ?.max,
                    ) > 0 &&
                    summary.n >=
                      Number(
                        configMenu?.additional_configuration?.allowed_objectives
                          ?.max,
                      )
                      ? "Limit Reached"
                      : "Create Objective"}
                  </Button>
                </div>
              ) : filteredObjectives.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-8 py-16 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <MdOutlineVisibility className="text-2xl text-slate-300" />
                  </div>
                  <p className="text-gray-700 font-medium text-lg">
                    No results found
                  </p>
                  <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                    We couldn't find any objectives matching "{searchTerm}"
                    {statusFilter !== "all"
                      ? ` with status ${statusFilter}`
                      : ""}
                    .
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                    }}
                    className="mt-6 text-sm font-bold text-primary hover:underline tracking-widest font-space h-auto p-0"
                  >
                    Clear All Filters
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredObjectives.map((obj) => (
                    <ObjectiveCard
                      key={obj.id}
                      id={`CO-${obj.id}`}
                      title={obj.title}
                      status={obj.status}
                      progress={obj.progress}
                      indirectProgress={obj.indirectProgress}
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  routeConstants.okrObjectiveDetail.replace(
                                    ":objectiveId",
                                    String(obj.id),
                                  ),
                                );
                              }}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-primary/10 transition-colors h-auto"
                            >
                              View Details
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  routeConstants.okrObjectiveDetail.replace(
                                    ":objectiveId",
                                    String(obj.id),
                                  ) + "?createKR=true",
                                );
                              }}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors h-auto"
                            >
                              + Add Key Result
                            </Button>
                          </div>
                          {obj.status !== "published" && (
                            <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                              {obj.krCount > 0 ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={MdPublish}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void publishSingleObjective(obj.id);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 tracking-widest font-space h-auto"
                                >
                                  Publish
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={MdEdit}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingObjective(obj);
                                  setForm({
                                    title: obj.title,
                                    description: obj.description,
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-800 tracking-widest font-space h-auto"
                              >
                                Edit
                              </Button>
                            </div>
                          )}
                        </>
                      }
                    >
                      {obj.keyResults?.length > 0 && (
                        <div className="flex flex-col gap-4 mt-2">
                          {obj.keyResults.map((kr: any) => {
                            const krDirectRaw =
                              kr.final_score ??
                              kr.progress_percent ??
                              kr.progress_pct ??
                              kr.progress;
                            const krTgt = Number(kr.target_value ?? 0);
                            const krCur = Number(
                              kr.current_value ??
                                kr.currentValue ??
                                kr.final_value ??
                                0,
                            );
                            const krPct =
                              krDirectRaw !== null && krDirectRaw !== undefined
                                ? Math.max(
                                    0,
                                    Math.min(100, Number(krDirectRaw)),
                                  )
                                : krTgt > 0
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
