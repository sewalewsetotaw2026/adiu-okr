import React, { useCallback, useEffect, useMemo, useState } from "react";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import RefreshButton from "../../../components/common/RefreshButton";
import { routeConstants } from "../../../../utils/constants";
import {
  MdFactCheck,
  MdFilterList,
  MdCheckCircle,
  MdClose,
  MdPublish,
  MdChevronRight,
  MdExpandMore,
} from "react-icons/md";

import ApprovalActionModal from "../components/modals/ApprovalActionModal";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import { okrAsArray, okrErrorMessage, okrUnwrap } from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import Button from "../../../components/Core/ui/Button";
import OkrStatusBadge from "../components/OkrStatusBadge";

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
  keyResults?: any[];
  parentId?: number;
};

export default function ApprovalQueuePage() {
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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
        route: apiRoutes.okr.managerPendingApprovals,
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
          keyResults: o.keyResults || [],
        });
      });

      const pendingObjectiveIds = new Set(objectives.map((o) => Number(o.id)));

      keyResults.forEach((k) => {
        newItems.push({
          id: `kr-${k.id}`,
          entityId: Number(k.id),
          employee:
            k.employee?.full_name || k.employee_name || k.user_id || "—",
          type: "key_result",
          summary: k.title || `Employee KR #${k.id}`,
          submittedAt: String(k.submitted_at ?? k.updated_at ?? "—"),
          status: k.status_code || "pending",
          parentId: Number(k.employee_objective_id || k.employeeObjective?.id),
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
    if (filter === "all") {
      const pendingObjectiveIds = new Set(
        items.filter((i) => i.type === "objective").map((i) => i.entityId),
      );
      // Filter out KRs whose parent objective is also in the pending list
      return items.filter((item) => {
        if (item.type === "key_result" && item.parentId) {
          return !pendingObjectiveIds.has(item.parentId);
        }
        return true;
      });
    }
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

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const ns = new Set(prev);
      if (ns.has(itemId)) ns.delete(itemId);
      else ns.add(itemId);
      return ns;
    });
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
          route: apiRoutes.okr.managerBulkApprove,
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
          route: apiRoutes.okr.managerApprove,
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

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white -mx-4 md:-mx-8 px-4 md:px-8">
        <ExecutionShell
          breadcrumbs={[
            { label: "My team", to: routeConstants.managerMyTeam },
            { label: "Approvals" },
          ]}
          title="OKR approval queue"
          subtitle="Review and approve pending employee execution items."
          icon={<MdFactCheck className="text-2xl" />}
          actions={<RefreshButton onClick={load} loading={loading} />}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-k-medium-grey uppercase tracking-wider">
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
                    className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors duration-200 ${
                      isActive
                        ? "bg-primary text-white ring-primary shadow-sm"
                        : "bg-white text-k-dark-grey ring-gray-200 hover:bg-gray-50 hover:ring-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {(selectedObjectiveIds.size > 0 ||
              selectedKrIds.size > 0 ||
              selectedMonthPlanIds.size > 0 ||
              selectedWeeklyPlanIds.size > 0 ||
              selectedDailyPlanIds.size > 0) && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-k-medium-grey">
                  {selectedObjectiveIds.size +
                    selectedKrIds.size +
                    selectedMonthPlanIds.size +
                    selectedWeeklyPlanIds.size +
                    selectedDailyPlanIds.size}{" "}
                  selected
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  icon={MdClose}
                  onClick={() => openModal("bulk", "reject")}
                >
                  Reject
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  icon={MdCheckCircle}
                  onClick={() => openModal("bulk", "approve")}
                >
                  Approve
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={MdPublish}
                  onClick={() => openModal("bulk", "publish")}
                >
                  Publish
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden mt-4">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p className="text-sm text-k-medium-grey">Loading approvals…</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm text-left align-middle">
                  <thead>
                    <tr className="border-b border-gray-100 bg-k-light-grey/60">
                      <th className="px-5 py-3.5 w-12">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-2 focus:ring-primary/30 cursor-pointer accent-primary"
                        />
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-k-medium-grey uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-k-medium-grey uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-k-medium-grey uppercase tracking-wider">
                        Summary
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-k-medium-grey uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-k-medium-grey uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 rounded-full bg-success/10 text-success flex items-center justify-center">
                              <MdCheckCircle className="text-3xl" />
                            </div>
                            <p className="text-sm font-semibold text-k-dark-grey">
                              All caught up
                            </p>
                            <p className="text-xs text-k-medium-grey">
                              No pending approvals right now.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => {
                        const isExpanded = expandedItems.has(row.id);
                        const isAccordionMode = filter === "all";
                        const hasKrs =
                          isAccordionMode &&
                          row.type === "objective" &&
                          row.keyResults &&
                          row.keyResults.length > 0;

                        return (
                          <React.Fragment key={row.id}>
                            <tr
                              className={`border-b border-gray-50 last:border-0 hover:bg-k-light-grey/50 transition-all duration-300 ${isSelected(row) ? "bg-primary/5" : ""} ${row.type === "objective" && isAccordionMode ? "cursor-pointer" : ""} ${isExpanded ? "bg-slate-50/80 ring-1 ring-inset ring-slate-100" : ""}`}
                              onClick={() => {
                                if (row.type === "objective" && isAccordionMode)
                                  toggleExpand(row.id);
                              }}
                            >
                              <td
                                className="px-5 py-4"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected(row)}
                                  onChange={() => toggleSelect(row)}
                                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-2 focus:ring-primary/30 cursor-pointer accent-primary"
                                />
                              </td>
                              <td className="px-5 py-4 font-medium text-k-dark-grey">
                                {row.employee}
                              </td>
                              <td className="px-5 py-4">
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
                              <td className="px-5 py-4 text-k-dark-grey">
                                <div className="flex items-center gap-3">
                                  {row.type === "objective" && hasKrs && (
                                    <span
                                      className={`text-gray-400 transition-transform duration-300 ${isExpanded ? "rotate-90 text-primary" : ""}`}
                                    >
                                      <MdChevronRight className="text-lg" />
                                    </span>
                                  )}
                                  <span
                                    className={`transition-colors duration-300 ${isExpanded ? "font-bold text-primary" : ""}`}
                                  >
                                    {row.summary}
                                  </span>
                                </div>
                              </td>

                              <td className="px-5 py-4 text-k-medium-grey tabular-nums text-xs">
                                {row.submittedAt}
                              </td>
                              <td
                                className="px-5 py-4 text-right whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-2">
                                  <Button
                                    variant="success"
                                    size="sm"
                                    onClick={() => openModal(row, "approve")}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openModal(row, "reject")}
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => openModal(row, "publish")}
                                  >
                                    Publish
                                  </Button>
                                </div>
                              </td>
                            </tr>
                            {isAccordionMode &&
                              isExpanded &&
                              row.keyResults?.map((kr: any, idx: number) => (
                                <tr
                                  key={`child-kr-${kr.id}`}
                                  className={`group bg-slate-50/40 border-b border-gray-100/50 transition-colors duration-200 hover:bg-slate-100/60 ${idx === row.keyResults.length - 1 ? "border-b-gray-200" : ""}`}
                                >
                                  <td className="px-5 py-3 relative">
                                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 ml-4"></div>
                                    {idx === row.keyResults.length - 1 && (
                                      <div className="absolute left-1/2 bottom-1/2 w-3 h-px bg-gray-200 ml-4"></div>
                                    )}
                                  </td>
                                  <td className="px-5 py-3"></td>
                                  <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-info/60"></div>
                                      <span className="text-[10px] font-bold text-info uppercase tracking-tight bg-info/5 px-2 py-0.5 rounded-md border border-info/10">
                                        Child KR
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3 text-xs text-k-medium-grey font-medium">
                                    {kr.title}
                                  </td>
                                  <td className="px-5 py-3"></td>
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ExecutionShell>

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
      </div>
    </EmployeeLayout>
  );
}
