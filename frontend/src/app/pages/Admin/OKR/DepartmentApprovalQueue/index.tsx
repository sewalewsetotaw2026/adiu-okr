import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import RefreshButton from "../../../../components/common/RefreshButton";
import { routeConstants } from "../../../../../utils/constants";
import {
  MdFactCheck,
  MdFilterList,
  MdCheckCircle,
  MdClose,
  MdPublish,
  MdChevronRight,
} from "react-icons/md";
import ApprovalActionModal from "../../../OKRExecution/components/modals/ApprovalActionModal";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import {
  okrAsArray,
  okrErrorMessage,
  okrUnwrap,
} from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import Button from "../../../../components/Core/ui/Button";
import OkrStatusBadge from "../../../OKRExecution/components/OkrStatusBadge";
import { useNavigate } from "react-router-dom";

type QueueItem = {
  id: string; // Used for UI key
  entityId: number; // The actual objective or kr id
  employee: string;
  type:
    | "objective"
    | "key_result"
    | "month_plan"
    | "weekly_plan"
    | "daily_plan";
  summary: string;
  submittedAt: string;
  status: string;
};

export default function DepartmentApprovalQueuePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    | "all"
    | "objective"
    | "key_result"
    | "month_plan"
    | "weekly_plan"
    | "daily_plan"
  >("all");

  // Bulk selection
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<Set<number>>(
    new Set(),
  );
  const [selectedKrIds, setSelectedKrIds] = useState<Set<number>>(new Set());
  const [selectedMonthPlanIds, setSelectedMonthPlanIds] = useState<Set<number>>(
    new Set(),
  );
  const [selectedWeeklyPlanIds, setSelectedWeeklyPlanIds] = useState<
    Set<number>
  >(new Set());
  const [selectedDailyPlanIds, setSelectedDailyPlanIds] = useState<Set<number>>(
    new Set(),
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState<QueueItem | "bulk" | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | "publish">(
    "approve",
  );
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        setItems([]);
        return;
      }

      const pendingRes = await makeCall({
        method: "GET",
        route: apiRoutes.okr.departmentPendingApprovals,
        query: { cycle_id: cid },
        isSecureRoute: true,
      });
      const pendingBody = okrUnwrap<any>(pendingRes) ?? {};

      const newItems: QueueItem[] = [];
      const objectives = okrAsArray<any>(pendingBody.pending_objectives ?? []);
      const keyResults = okrAsArray<any>(pendingBody.pending_krs ?? []);
      const monthPlans = okrAsArray<any>(pendingBody.pending_month_plans ?? []);
      const weeklyPlans = okrAsArray<any>(
        pendingBody.pending_weekly_plans ?? [],
      );
      const dailyPlans = okrAsArray<any>(pendingBody.pending_daily_plans ?? []);

      objectives.forEach((o) => {
        newItems.push({
          id: `obj-${o.id}`,
          entityId: Number(o.id),
          employee:
            o.employee?.full_name || o.employee_name || o.user_id || "—",
          type: "objective",
          summary: o.title || `Employee Objective #${o.id}`,
          submittedAt: String(o.submitted_at ?? o.updated_at ?? "—"),
          status: o.status_code || "pending",
        });
      });

      keyResults.forEach((k) => {
        newItems.push({
          id: `kr-${k.id}`,
          entityId: Number(k.id),
          employee:
            k.employee?.full_name || k.employee_name || k.user_id || "—",
          type: "key_result",
          summary: k.title || `Employee Key Result #${k.id}`,
          submittedAt: String(k.submitted_at ?? k.updated_at ?? "—"),
          status: k.status_code || "pending",
        });
      });

      monthPlans.forEach((p) => {
        newItems.push({
          id: `mp-${p.id}`,
          entityId: Number(p.id),
          employee:
            p.employee?.full_name || p.employee_name || p.user_id || "—",
          type: "month_plan",
          summary: p.title || p.description || `Month Plan #${p.id}`,
          submittedAt: String(p.submitted_at ?? p.updated_at ?? "—"),
          status: p.status_code || "pending",
        });
      });

      weeklyPlans.forEach((p) => {
        newItems.push({
          id: `wp-${p.id}`,
          entityId: Number(p.id),
          employee:
            p.employee?.full_name || p.employee_name || p.user_id || "—",
          type: "weekly_plan",
          summary:
            p.title ||
            `Week ${p.week_number ?? "?"} plan` ||
            `Weekly Plan #${p.id}`,
          submittedAt: String(p.submitted_at ?? p.updated_at ?? "—"),
          status: p.status_code || "pending",
        });
      });

      dailyPlans.forEach((p) => {
        newItems.push({
          id: `dp-${p.id}`,
          entityId: Number(p.id),
          employee:
            p.employee?.full_name || p.employee_name || p.user_id || "—",
          type: "daily_plan",
          summary: p.title || p.description || `Daily Plan #${p.id}`,
          submittedAt: String(p.submitted_at ?? p.updated_at ?? "—"),
          status: p.status_code || "pending",
        });
      });

      setItems(newItems);
      setSelectedObjectiveIds(new Set());
      setSelectedKrIds(new Set());
      setSelectedMonthPlanIds(new Set());
      setSelectedWeeklyPlanIds(new Set());
      setSelectedDailyPlanIds(new Set());
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((x) => x.type === filter);
  }, [filter, items]);

  const toggleSelect = (item: QueueItem) => {
    if (item.type === "objective") {
      setSelectedObjectiveIds((prev) => {
        const ns = new Set(prev);
        if (ns.has(item.entityId)) ns.delete(item.entityId);
        else ns.add(item.entityId);
        return ns;
      });
    } else if (item.type === "key_result") {
      setSelectedKrIds((prev) => {
        const ns = new Set(prev);
        if (ns.has(item.entityId)) ns.delete(item.entityId);
        else ns.add(item.entityId);
        return ns;
      });
    } else if (item.type === "month_plan") {
      setSelectedMonthPlanIds((prev) => {
        const ns = new Set(prev);
        if (ns.has(item.entityId)) ns.delete(item.entityId);
        else ns.add(item.entityId);
        return ns;
      });
    } else if (item.type === "weekly_plan") {
      setSelectedWeeklyPlanIds((prev) => {
        const ns = new Set(prev);
        if (ns.has(item.entityId)) ns.delete(item.entityId);
        else ns.add(item.entityId);
        return ns;
      });
    } else {
      setSelectedDailyPlanIds((prev) => {
        const ns = new Set(prev);
        if (ns.has(item.entityId)) ns.delete(item.entityId);
        else ns.add(item.entityId);
        return ns;
      });
    }
  };

  const openModal = (item: QueueItem | "bulk", a: typeof action) => {
    if (
      item === "bulk" &&
      selectedObjectiveIds.size === 0 &&
      selectedKrIds.size === 0 &&
      selectedMonthPlanIds.size === 0 &&
      selectedWeeklyPlanIds.size === 0 &&
      selectedDailyPlanIds.size === 0
    ) {
      ToastService.error("No items selected");
      return;
    }
    setActive(item);
    setAction(a as "approve" | "reject");
    setComment("");
    setModalOpen(true);
  };

  const toEntityType = (type: QueueItem["type"]) => {
    if (type === "objective") return "EMPLOYEE_OBJECTIVE";
    if (type === "key_result") return "EMPLOYEE_KR";
    if (type === "month_plan") return "EMPLOYEE_MONTH_PLAN";
    if (type === "weekly_plan") return "WEEKLY_PLAN";
    return "DAILY_PLAN";
  };

  const confirm = async () => {
    if (!active) return;
    if (action === "reject" && !comment.trim()) {
      ToastService.error("Add a comment for rejection / changes requested.");
      return;
    }
    setSubmitting(true);

    try {
      const actionCode =
        action === "approve"
          ? "APPROVED"
          : action === "reject"
            ? "CHANGES_REQUESTED"
            : "PUBLISHED";

      if (active === "bulk") {
        const objIds = Array.from(selectedObjectiveIds);
        const krIds = Array.from(selectedKrIds);
        const monthPlanIds = Array.from(selectedMonthPlanIds);
        const weeklyPlanIds = Array.from(selectedWeeklyPlanIds);
        const dailyPlanIds = Array.from(selectedDailyPlanIds);
        await makeCall({
          method: "POST",
          route: apiRoutes.okr.departmentBulkApproveItems,
          body: {
            objective_ids: objIds,
            kr_ids: krIds,
            month_plan_ids: monthPlanIds,
            weekly_plan_ids: weeklyPlanIds,
            daily_plan_ids: dailyPlanIds,
            action: actionCode,
            comments: comment.trim() || undefined,
          },
          isSecureRoute: true,
        });
      } else {
        await makeCall({
          method: "POST",
          route: apiRoutes.okr.departmentApproveItem,
          body: {
            entity_type: toEntityType(active.type),
            entity_id: active.entityId,
            action: actionCode,
            comments: comment.trim() || undefined,
          },
          isSecureRoute: true,
        });
      }

      ToastService.success(
        action === "approve"
          ? "Approved selected items."
          : action === "reject"
            ? "Feedback sent for selected items."
            : "Published selected items.",
      );
      setModalOpen(false);
      await load();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const isSelected = (item: QueueItem) => {
    if (item.type === "objective")
      return selectedObjectiveIds.has(item.entityId);
    if (item.type === "key_result") return selectedKrIds.has(item.entityId);
    if (item.type === "month_plan")
      return selectedMonthPlanIds.has(item.entityId);
    if (item.type === "weekly_plan")
      return selectedWeeklyPlanIds.has(item.entityId);
    return selectedDailyPlanIds.has(item.entityId);
  };

  const toggleAll = () => {
    if (
      selectedObjectiveIds.size > 0 ||
      selectedKrIds.size > 0 ||
      selectedMonthPlanIds.size > 0 ||
      selectedWeeklyPlanIds.size > 0 ||
      selectedDailyPlanIds.size > 0
    ) {
      setSelectedObjectiveIds(new Set());
      setSelectedKrIds(new Set());
      setSelectedMonthPlanIds(new Set());
      setSelectedWeeklyPlanIds(new Set());
      setSelectedDailyPlanIds(new Set());
    } else {
      const newObjs = new Set<number>();
      const newKrs = new Set<number>();
      const newMonthPlans = new Set<number>();
      const newWeeklyPlans = new Set<number>();
      const newDailyPlans = new Set<number>();
      filtered.forEach((f) => {
        if (f.type === "objective") newObjs.add(f.entityId);
        else if (f.type === "key_result") newKrs.add(f.entityId);
        else if (f.type === "month_plan") newMonthPlans.add(f.entityId);
        else if (f.type === "weekly_plan") newWeeklyPlans.add(f.entityId);
        else newDailyPlans.add(f.entityId);
      });
      setSelectedObjectiveIds(newObjs);
      setSelectedKrIds(newKrs);
      setSelectedMonthPlanIds(newMonthPlans);
      setSelectedWeeklyPlanIds(newWeeklyPlans);
      setSelectedDailyPlanIds(newDailyPlans);
    }
  };

  const allSelected =
    filtered.length > 0 &&
    selectedObjectiveIds.size +
      selectedKrIds.size +
      selectedMonthPlanIds.size +
      selectedWeeklyPlanIds.size +
      selectedDailyPlanIds.size ===
      filtered.length;

  const formatDate = (iso: string) => {
    if (!iso || iso === "—") return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8 pt-2">
          <nav className="flex flex-wrap items-center gap-2 text-sm pt-4">
            <button
              type="button"
              onClick={() => navigate(routeConstants.okr)}
              className="text-gray-500 hover:text-gray-800 transition-colors"
            >
              OKR
            </button>
            <MdChevronRight className="text-gray-300 shrink-0 text-lg" />
            <span className="text-gray-800 font-medium">Approvals</span>
          </nav>

          <PageHeader>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3 text-white">
                  <div className="rounded-xl bg-white/10 p-2 border border-white/10 shrink-0">
                    <MdFactCheck className="text-2xl" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">
                      Department Approvals
                    </h1>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded border border-white/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[10px] font-black text-white/90 uppercase tracking-widest font-space">
                          Live Queue
                        </span>
                      </div>
                      <p className="text-white/60 text-[10px] font-black uppercase tracking-widest font-space">
                        Review and approve departmental alignment
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <RefreshButton
                    onClick={load}
                    loading={loading}
                    className="bg-white/10 ring-white/20 text-white hover:bg-white/20 shadow-xl shadow-black/10"
                  />
                  {(selectedObjectiveIds.size > 0 ||
                    selectedKrIds.size > 0 ||
                    selectedMonthPlanIds.size > 0 ||
                    selectedWeeklyPlanIds.size > 0 ||
                    selectedDailyPlanIds.size > 0) && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                      <span className="text-[10px] font-black text-white/90 uppercase tracking-widest font-space mr-2">
                        {selectedObjectiveIds.size +
                          selectedKrIds.size +
                          selectedMonthPlanIds.size +
                          selectedWeeklyPlanIds.size +
                          selectedDailyPlanIds.size}{" "}
                        selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openModal("bulk", "reject")}
                        className="text-white ring-white/30 hover:bg-white/20 uppercase tracking-widest font-space text-[10px] font-black"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="white"
                        size="sm"
                        icon={MdCheckCircle}
                        onClick={() => openModal("bulk", "approve")}
                        className="uppercase tracking-widest font-space text-[10px] font-black"
                      >
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </PageHeader>

          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
                <MdFilterList className="text-base" /> Filter
              </span>
              {(
                [
                  ["all", "All"],
                  ["objective", "Objectives"],
                  ["key_result", "Key Results"],
                  ["month_plan", "Month Plans"],
                  ["weekly_plan", "Weekly Plans"],
                  ["daily_plan", "Daily Plans"],
                ] as const
              ).map(([id, label]) => {
                const isActive = filter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={`cursor-pointer rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest font-space transition-all duration-200 ${
                      isActive
                        ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                        : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 overflow-hidden">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
                  Loading approvals…
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm text-left align-middle">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer transition-all hover:scale-110"
                        />
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">
                        Employee
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">
                        Type
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">
                        Summary
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space">
                        Submitted
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-space text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-20 text-center space-y-3"
                        >
                          <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                            <MdFactCheck className="text-3xl text-gray-300" />
                          </div>
                          <div>
                            <p className="text-gray-900 font-medium">
                              All caught up!
                            </p>
                            <p className="text-gray-500 text-xs">
                              No pending approvals right now.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => (
                        <tr
                          key={row.id}
                          className={`group transition-all duration-200 hover:bg-slate-50/50 ${
                            isSelected(row) ? "bg-primary/5" : ""
                          }`}
                        >
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected(row)}
                              onChange={() => toggleSelect(row)}
                              className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer transition-all group-hover:scale-110"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                              {row.employee}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <OkrStatusBadge
                              tone={
                                row.type === "objective"
                                  ? "primary"
                                  : row.type === "key_result"
                                    ? "info"
                                    : row.type === "month_plan"
                                      ? "warning"
                                      : row.type === "weekly_plan"
                                        ? "neutral"
                                        : "muted"
                              }
                              size="xs"
                              className="font-space font-black uppercase tracking-widest text-[9px]"
                            >
                              {row.type === "objective"
                                ? "Objective"
                                : row.type === "key_result"
                                  ? "Key Result"
                                  : row.type === "month_plan"
                                    ? "Month Plan"
                                    : row.type === "weekly_plan"
                                      ? "Weekly Plan"
                                      : "Daily Plan"}
                            </OkrStatusBadge>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-slate-700 font-medium line-clamp-1 max-w-sm">
                              {row.summary}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
                              {formatDate(row.submittedAt)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 transition-opacity">
                              <Button
                                variant="white"
                                size="sm"
                                onClick={() => openModal(row, "approve")}
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-100 uppercase tracking-widest font-space text-[10px] font-black"
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openModal(row, "reject")}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 uppercase tracking-widest font-space text-[10px] font-black"
                              >
                                Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <ApprovalActionModal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        itemSummary={
          active === "bulk"
            ? `Bulk action for ${
                selectedObjectiveIds.size +
                selectedKrIds.size +
                selectedMonthPlanIds.size +
                selectedWeeklyPlanIds.size +
                selectedDailyPlanIds.size
              } items`
            : active
              ? `${active.employee}: ${active.summary}`
              : ""
        }
        action={action}
        comment={comment}
        onChangeComment={setComment}
        onConfirm={confirm}
        loading={submitting}
      />
    </AdminLayout>
  );
}
