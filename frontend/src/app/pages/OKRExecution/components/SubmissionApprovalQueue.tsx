import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MdFactCheck,
  MdFilterList,
  MdCheckCircle,
  MdExpandMore,
  MdExpandLess,
  MdComment,
  MdClose,
  MdSend,
} from "react-icons/md";
import ApprovalActionModal from "./modals/ApprovalActionModal";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import { okrErrorMessage, okrUnwrap } from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import Button from "../../../components/Core/ui/Button";
import OkrStatusBadge from "./OkrStatusBadge";
import RefreshButton from "../../../components/common/RefreshButton";
import ChangeRequestReviewTab from "../../Admin/OKR/components/ChangeRequestReviewTab";
import { MdEditDocument } from "react-icons/md";

type Submission = {
  id: number;
  type: string;
  status: string;
  submitter_name: string;
  submitter_id: string;
  item_count: number;
  created_at: string;
  employeeObjectives: Array<{
    id: number;
    title: string;
    status_code: string;
    keyResults: Array<{
      id: number;
      title: string;
      status_code: string;
      weight_percent?: number;
      metricDefinition?: { name: string; unit_of_measure: string };
    }>;
  }>;
  employeeMonthPlans: Array<{
    id: number;
    title: string;
    status_code?: string;
    plan_status?: string;
    month_number?: number;
  }>;
  weeklyPlans: Array<{
    id: number;
    title: string;
    status_code?: string;
    plan_status?: string;
    week_number?: number;
  }>;
};

type PendingFeedback = {
  entity_type: string;
  entity_id: number;
  comment: string;
};

function FeedbackBatchInput({
  entityType,
  entityId,
  onAdd,
  hasPending,
}: {
  entityType: string;
  entityId: number;
  onAdd: (feedback: PendingFeedback) => void;
  hasPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const handleAdd = () => {
    if (!text.trim()) return;
    onAdd({
      entity_type: entityType,
      entity_id: entityId,
      comment: text.trim(),
    });
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        icon={MdComment}
        className={`text-[10px] font-bold uppercase tracking-widest font-space transition-colors p-0 h-auto ${
          hasPending
            ? "text-red-600 hover:text-red-700"
            : "text-amber-600 hover:text-amber-700"
        }`}
      >
        {hasPending ? "Pending" : "Feedback"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2 animate-in slide-in-from-top-2 duration-200">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add feedback..."
        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        autoFocus
      />
      <Button
        variant="primary"
        size="sm"
        onClick={handleAdd}
        disabled={!text.trim()}
        icon={MdSend}
        className="p-1.5 rounded-lg"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(false);
          setText("");
        }}
        icon={MdClose}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
      />
    </div>
  );
}

function SubmissionReviewCard({
  submission,
  onApprove,
  onReject,
  onRefresh,
}: {
  submission: Submission;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [pendingFeedbacks, setPendingFeedbacks] = useState<PendingFeedback[]>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);

  const typeLabel =
    submission.type === "QUARTERLY_PLANNING"
      ? "Quarterly Plan"
      : submission.type === "DEPARTMENT_OBJECTIVE"
        ? "Department Plan"
        : submission.type === "MONTHLY_PLAN"
          ? "Monthly Plan"
          : "Weekly Plan";

  const typeTone =
    submission.type === "QUARTERLY_PLANNING" ||
    submission.type === "DEPARTMENT_OBJECTIVE"
      ? "primary"
      : submission.type === "MONTHLY_PLAN"
        ? "warning"
        : "info";

  const statusTone =
    submission.status === "pending_approval"
      ? "warning"
      : submission.status === "approved"
        ? "success"
        : submission.status === "rejected"
          ? "danger"
          : "neutral";

  const isPending = submission.status === "pending_approval";

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const hasDraftItems =
    submission.employeeObjectives.some(
      (o) =>
        o.status_code === "draft" ||
        o.keyResults.some((kr) => kr.status_code === "draft"),
    ) ||
    submission.employeeMonthPlans.some(
      (p) => (p.plan_status || p.status_code) === "DRAFT",
    ) ||
    submission.weeklyPlans.some(
      (p) => (p.plan_status || p.status_code) === "DRAFT",
    );

  const addFeedback = (feedback: PendingFeedback) => {
    setPendingFeedbacks([...pendingFeedbacks, feedback]);
  };

  const removeFeedback = (index: number) => {
    setPendingFeedbacks(pendingFeedbacks.filter((_, i) => i !== index));
  };

  const sendAllFeedbacks = async () => {
    if (pendingFeedbacks.length === 0) return;
    setSubmitting(true);
    try {
      await makeCall({
        method: "POST",
        route: apiRoutes.okr.submissionFeedbackBatch,
        body: {
          feedbacks: pendingFeedbacks,
        },
        isSecureRoute: true,
      });
      ToastService.success(
        `${pendingFeedbacks.length} feedback(s) sent. Plan reverted to draft.`,
      );
      setPendingFeedbacks([]);
      onRefresh();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const getItemFeedbackCount = (entityType: string, entityId: number) => {
    return pendingFeedbacks.filter(
      (f) => f.entity_type === entityType && f.entity_id === entityId,
    ).length;
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/30 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/40">
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <MdFactCheck className="text-xl text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900">
                {submission.submitter_name}
              </h3>
              <OkrStatusBadge
                tone={typeTone as any}
                size="xs"
                className="font-space font-black uppercase tracking-widest text-[9px]"
              >
                {typeLabel}
              </OkrStatusBadge>
              <OkrStatusBadge
                tone={statusTone as any}
                size="xs"
                className="font-space font-black uppercase tracking-widest text-[9px]"
              >
                {submission.status.replace(/_/g, " ")}
              </OkrStatusBadge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-space mt-1">
              {hasDraftItems && (
                <span className="ml-2 text-amber-500">
                  · Has pending feedback
                </span>
              )}
              {pendingFeedbacks.length > 0 && (
                <span className="ml-2 text-red-500 font-black">
                  · {pendingFeedbacks.length} pending feedback(s)
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(submission.id);
                }}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 uppercase tracking-widest font-space text-[10px] font-black"
                disabled={submitting}
              >
                Reject All
              </Button>
              <Button
                variant="white"
                size="sm"
                icon={MdCheckCircle}
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(submission.id);
                }}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-100 uppercase tracking-widest font-space text-[10px] font-black"
                disabled={hasDraftItems || submitting}
                title={
                  hasDraftItems ? "Resolve all feedback before approving" : ""
                }
              >
                Approve All
              </Button>
            </>
          )}
          {expanded ? (
            <MdExpandLess className="text-xl text-slate-400" />
          ) : (
            <MdExpandMore className="text-xl text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-50 px-6 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {submission.employeeObjectives.map((obj) => (
            <div
              key={`obj-${obj.id}`}
              className="rounded-xl border border-slate-100 bg-slate-50/30 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest font-space bg-primary/5 px-2 py-0.5 rounded">
                      Objective
                    </span>
                    <OkrStatusBadge
                      tone={
                        obj.status_code === "draft"
                          ? "warning"
                          : obj.status_code === "pending_approval"
                            ? "info"
                            : "success"
                      }
                      size="xs"
                      className="font-space font-black uppercase tracking-widest text-[9px]"
                    >
                      {obj.status_code.replace(/_/g, " ")}
                    </OkrStatusBadge>
                  </div>
                  <p className="font-semibold text-slate-800 mt-1.5">
                    {obj.title}
                  </p>
                </div>
                {isPending && (
                  <FeedbackBatchInput
                    entityType="EMPLOYEE_OBJECTIVE"
                    entityId={obj.id}
                    onAdd={addFeedback}
                    hasPending={
                      getItemFeedbackCount("EMPLOYEE_OBJECTIVE", obj.id) > 0
                    }
                  />
                )}
              </div>

              {obj.keyResults.length > 0 && (
                <div className="mt-3 ml-4 space-y-2 border-l-2 border-primary/10 pl-4">
                  {obj.keyResults.map((kr, index) => (
                    <div
                      key={`kr-${kr.id}`}
                      className="flex items-start justify-between py-2 gap-3"
                    >
                      <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-[10px] font-black text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-blue-500/60 uppercase tracking-widest font-space bg-blue-50 px-2 py-0.5 rounded">
                            Key Result
                          </span>
                          <OkrStatusBadge
                            tone={
                              kr.status_code === "draft"
                                ? "warning"
                                : kr.status_code === "pending_approval"
                                  ? "info"
                                  : "success"
                            }
                            size="xs"
                            className="font-space font-black uppercase tracking-widest text-[9px]"
                          >
                            {kr.status_code.replace(/_/g, " ")}
                          </OkrStatusBadge>
                          {kr.weight_percent != null && (
                            <span className="text-[9px] font-bold text-slate-400 font-space">
                              {kr.weight_percent}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 mt-1">
                          {kr.title}
                        </p>
                        {kr.metricDefinition && (
                          <p className="text-[10px] text-slate-400 font-space mt-0.5">
                            Metric: {kr.metricDefinition.name} (
                            {kr.metricDefinition.unit_of_measure})
                          </p>
                        )}
                      </div>
                      {isPending && (
                        <FeedbackBatchInput
                          entityType="EMPLOYEE_KR"
                          entityId={kr.id}
                          onAdd={addFeedback}
                          hasPending={
                            getItemFeedbackCount("EMPLOYEE_KR", kr.id) > 0
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {submission.employeeMonthPlans.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
                Month Plans
              </p>
              {submission.employeeMonthPlans.map((p) => {
                const monthStatus = p.plan_status || p.status_code || "DRAFT";
                return (
                  <div
                    key={`mp-${p.id}`}
                    className="rounded-xl border border-amber-100/50 bg-amber-50/50 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-amber-600/60 uppercase tracking-widest font-space bg-amber-100 px-2 py-0.5 rounded">
                          Month {p.month_number ?? "?"}
                        </span>
                        <span className="text-sm text-slate-700">
                          {p.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <OkrStatusBadge
                          tone={monthStatus === "DRAFT" ? "warning" : "info"}
                          size="xs"
                          className="font-space font-black uppercase tracking-widest text-[9px]"
                        >
                          {String(monthStatus).replace(/_/g, " ")}
                        </OkrStatusBadge>
                        {isPending && (
                          <FeedbackBatchInput
                            entityType="EMPLOYEE_MONTH_PLAN"
                            entityId={p.id}
                            onAdd={addFeedback}
                            hasPending={
                              getItemFeedbackCount(
                                "EMPLOYEE_MONTH_PLAN",
                                p.id,
                              ) > 0
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {submission.weeklyPlans.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
                Weekly Plans
              </p>
              {submission.weeklyPlans.map((p) => {
                const weekStatus = p.plan_status || p.status_code || "DRAFT";
                return (
                  <div
                    key={`wp-${p.id}`}
                    className="rounded-xl border border-blue-100/50 bg-blue-50/50 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-blue-600/60 uppercase tracking-widest font-space bg-blue-100 px-2 py-0.5 rounded">
                          Week {p.week_number ?? "?"}
                        </span>
                        <span className="text-sm text-slate-700">
                          {p.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <OkrStatusBadge
                          tone={weekStatus === "DRAFT" ? "warning" : "info"}
                          size="xs"
                          className="font-space font-black uppercase tracking-widest text-[9px]"
                        >
                          {String(weekStatus).replace(/_/g, " ")}
                        </OkrStatusBadge>
                        {isPending && (
                          <FeedbackBatchInput
                            entityType="WEEKLY_PLAN"
                            entityId={p.id}
                            onAdd={addFeedback}
                            hasPending={
                              getItemFeedbackCount("WEEKLY_PLAN", p.id) > 0
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending Feedbacks Summary */}
          {pendingFeedbacks.length > 0 && (
            <div className="mt-6 pt-4 border-t-2 border-amber-200 bg-amber-50/50 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-800 mb-2">
                    Pending Feedbacks ({pendingFeedbacks.length})
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {pendingFeedbacks.map((fb, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-[13px] text-slate-700"
                      >
                        <span className="text-amber-600 font-black">·</span>
                        <span className="flex-1 line-clamp-2">
                          {fb.comment}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFeedback(idx)}
                          icon={MdClose}
                          className="p-0.5 text-slate-400 hover:text-slate-600 flex-shrink-0"
                          title="Remove this feedback"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  variant="primary"
                  className="rounded-xl whitespace-nowrap font-bold shadow-lg shadow-primary/20"
                  onClick={sendAllFeedbacks}
                  disabled={submitting}
                  icon={MdSend}
                >
                  {submitting ? "Sending..." : "Send Feedbacks"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SubmissionApprovalQueue({
  viewerType,
}: {
  viewerType: "admin" | "manager";
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "pending_approval" | "approved" | "rejected"
  >("all");
  const [planType, setPlanType] = useState<
    | "all"
    | "QUARTERLY_PLANNING"
    | "DEPARTMENT_OBJECTIVE"
    | "MONTHLY_PLAN"
    | "WEEKLY_PLAN"
  >("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(
    null,
  );
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"standard" | "edits">("standard");

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
        setSubmissions([]);
        return;
      }

      // Single-level review flow: each reviewer only sees submissions assigned
      // to them, regardless of whether they are manager/admin/CEO.
      const route =
        viewerType === "admin"
          ? apiRoutes.okr.managerSubmissions
          : apiRoutes.okr.managerSubmissions;

      const res = await makeCall({
        method: "GET",
        route,
        query: { cycle_id: cid },
        isSecureRoute: true,
      });
      const data = okrUnwrap<any>(res);
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [viewerType]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = submissions;
    if (filter !== "all") list = list.filter((s) => s.status === filter);
    if (planType !== "all") list = list.filter((s) => s.type === planType);
    return list;
  }, [filter, planType, submissions]);

  const pendingCount = submissions.filter(
    (s) => s.status === "pending_approval",
  ).length;

  const openModal = (
    submissionId: number,
    nextAction: "approve" | "reject",
  ) => {
    setActiveSubmissionId(submissionId);
    setAction(nextAction);
    setComment("");
    setModalOpen(true);
  };

  const confirm = async () => {
    if (!activeSubmissionId) return;
    if (action === "reject" && !comment.trim()) {
      ToastService.error("A reason is required for rejection.");
      return;
    }
    setSubmitting(true);
    try {
      if (action === "approve") {
        await makeCall({
          method: "POST",
          route: apiRoutes.okr.approveSubmission(activeSubmissionId),
          isSecureRoute: true,
        });
        ToastService.success("Submission approved.");
      } else {
        await makeCall({
          method: "POST",
          route: apiRoutes.okr.rejectSubmission(activeSubmissionId),
          body: { reason: comment.trim() },
          isSecureRoute: true,
        });
        ToastService.success(
          "Submission rejected. All items reverted to draft.",
        );
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant={activeTab === "standard" ? "primary" : "white"}
          onClick={() => setActiveTab("standard")}
          icon={MdFactCheck}
          className={`rounded-2xl transition-all duration-300 ${activeTab === "standard" ? "shadow-lg shadow-primary/20" : ""}`}
        >
          Plan Submissions
        </Button>
        <Button
          variant={activeTab === "edits" ? "primary" : "white"}
          onClick={() => setActiveTab("edits")}
          icon={MdEditDocument}
          className={`rounded-2xl transition-all duration-300 ${activeTab === "edits" ? "shadow-lg shadow-primary/20" : ""}`}
        >
          Edit Requests
        </Button>
      </div>

      {activeTab === "edits" ? (
        <ChangeRequestReviewTab />
      ) : (
        <>
          <div className="bg-white/60 backdrop-blur-xl border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <MdFactCheck className="text-primary text-lg" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] font-space">
                    Pending Approvals
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {pendingCount} submission{pendingCount === 1 ? "" : "s"}{" "}
                    waiting review
                  </p>
                </div>
              </div>
              <RefreshButton onClick={load} loading={loading} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <MdFilterList className="text-primary text-sm" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] font-space">
                    Submission Status
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["all", "All"],
                      ["pending_approval", "Pending"],
                      ["approved", "Approved"],
                      ["rejected", "Rejected"],
                    ] as const
                  ).map(([id, label]) => (
                    <Button
                      key={id}
                      variant={filter === id ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => setFilter(id)}
                      className={`rounded-xl px-4 py-2 text-[10px] font-black tracking-widest font-space transition-all duration-300 ${
                        filter === id
                          ? "shadow-lg shadow-primary/20 scale-105"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                      }`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-6 md:pt-0 md:pl-6">
                <div className="flex items-center gap-2 px-1">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <MdFactCheck className="text-blue-600 text-sm" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] font-space">
                    Plan Category
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["all", "All Plans"],
                      ["QUARTERLY_PLANNING", "Quarterly"],
                      ["DEPARTMENT_OBJECTIVE", "Department"],
                      ["MONTHLY_PLAN", "Monthly"],
                      ["WEEKLY_PLAN", "Weekly"],
                    ] as const
                  ).map(([id, label]) => (
                    <Button
                      key={id}
                      variant={planType === id ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => setPlanType(id)}
                      className={`rounded-xl px-4 py-2 text-[10px] font-black tracking-widest font-space transition-all duration-300 ${
                        planType === id
                          ? "shadow-lg shadow-primary/20 scale-105"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                      }`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 mt-6">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40">
                <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-space">
                  Loading submissions...
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40">
                <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <MdFactCheck className="text-3xl text-gray-300" />
                </div>
                <p className="text-gray-900 font-medium">All caught up!</p>
                <p className="text-gray-500 text-xs">
                  No submissions to review right now.
                </p>
              </div>
            ) : (
              filtered.map((sub) => (
                <SubmissionReviewCard
                  key={sub.id}
                  submission={sub}
                  onApprove={(id) => openModal(id, "approve")}
                  onReject={(id) => openModal(id, "reject")}
                  onRefresh={load}
                />
              ))
            )}
          </div>

          <ApprovalActionModal
            isOpen={modalOpen}
            onClose={() => !submitting && setModalOpen(false)}
            itemSummary={
              activeSubmissionId
                ? `Submission #${activeSubmissionId} — ${
                    action === "approve"
                      ? "Approve entire plan"
                      : "Reject entire plan"
                  }`
                : ""
            }
            action={action}
            comment={comment}
            onChangeComment={setComment}
            onConfirm={confirm}
            loading={submitting}
          />
        </>
      )}
    </>
  );
}
