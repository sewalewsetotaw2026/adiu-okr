import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import RefreshButton from "../../../components/common/RefreshButton";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import {
  MdPerson,
  MdDateRange,
  MdEventNote,
  MdCheckCircle,
  MdErrorOutline,
  MdMessage,
  MdOutlineFeedback,
} from "react-icons/md";
import {
  fetchSubmissionById,
  approveSubmission,
  postSubmissionComment,
  rejectSubmission,
} from "../../../services/okr-execution.api";
import { PlanSubmission } from "../../../../types/okr.types";
import { okrErrorMessage } from "../../../utils/okrApi";
import ToastService from "../../../../utils/ToastService";
import Button from "../../../components/Core/ui/Button";
import CommentThread from "./components/CommentThread";

export default function ReviewDetail() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<PlanSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState("");

  const loadDetail = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const data = await fetchSubmissionById(planId);
      setSubmission(data);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      navigate("/okr/reviews");
    } finally {
      setLoading(false);
    }
  }, [planId, navigate]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const toggleComments = (itemId: string) => {
    setOpenComments((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleApprove = async () => {
    if (!planId || !submission) return;
    setSubmitting(true);
    try {
      await approveSubmission(planId);
      ToastService.success("Plan approved successfully.");
      navigate("/okr/reviews");
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = () => {
    // Open rejection modal instead of directly rejecting
    setRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!planId || !submission) return;
    if (!rejectFeedback.trim()) {
      ToastService.error("Please provide feedback for the rejection.");
      return;
    }

    setSubmitting(true);
    try {
      // First, post the rejection comment
      await postSubmissionComment({
        submission_id: submission.id,
        comment: rejectFeedback.trim(),
      });

      // Then reject the submission
      await rejectSubmission(planId);

      ToastService.success(
        "Changes requested. Feedback has been sent to the employee.",
      );
      setRejectModalOpen(false);
      navigate("/okr/reviews");
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <EmployeeLayout>
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-slate-500 animate-pulse">
            Loading submission details...
          </p>
        </div>
      </EmployeeLayout>
    );
  }

  if (!submission) return null;

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-slate-50/50 -mx-4 md:-mx-8 px-4 md:px-8 pb-32">
        <ExecutionShell
          breadcrumbs={[
            { label: "OKR Management", to: "/okr/reviews" },
            { label: "Review Dashboard", to: "/okr/reviews" },
            {
              label: `${submission.plan_type === "MONTHLY" ? "Monthly" : "Weekly"} Plan Review`,
            },
          ]}
          title={`${submission.employee_name}'s Plan`}
          subtitle={`Reviewing the ${submission.plan_type.toLowerCase()} execution plan for ${submission.plan_type === "MONTHLY" ? submission.cycle_name : `Week ${submission.week_number}`}.`}
          icon={
            submission.plan_type === "MONTHLY" ? (
              <MdDateRange className="text-2xl" />
            ) : (
              <MdEventNote className="text-2xl" />
            )
          }
          actions={<RefreshButton onClick={loadDetail} loading={loading} />}
        >
          <div className="space-y-6">
            {/* Header Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                  {submission.avatar_url ? (
                    <img
                      src={submission.avatar_url}
                      alt={submission.employee_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <MdPerson className="text-slate-400 text-2xl" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {submission.employee_name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Submitted on{" "}
                    {new Date(submission.submitted_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">
                    Status
                  </p>
                  <span className="px-3 py-1 bg-warning/10 text-warning text-xs font-bold rounded-full uppercase tracking-wider">
                    {submission.status}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">
                    Items
                  </p>
                  <span className="text-lg font-bold text-slate-800">
                    {submission.item_count}
                  </span>
                </div>
              </div>
            </div>

            {/* Plan Items */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 px-2">
                <MdOutlineFeedback className="text-primary" />
                Planned Activities
              </h3>

              <div className="grid grid-cols-1 gap-4">
                {submission.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="space-y-1 flex-1">
                          <h4 className="text-base font-bold text-slate-800">
                            {item.title}
                          </h4>
                          <p className="text-sm text-slate-600 line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <Button
                            variant={
                              openComments[item.id] ? "primary" : "white"
                            }
                            size="sm"
                            icon={MdMessage}
                            onClick={() => toggleComments(item.id)}
                            className="rounded-xl h-9"
                          >
                            {openComments[item.id]
                              ? "Hide Comments"
                              : "Comments"}
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Associated Key Result:
                          </span>
                          <span className="text-xs font-semibold text-slate-700">
                            {item.parent_kr_title || item.kr_title || "General"}
                          </span>
                        </div>
                        {item.weight_pct > 0 && (
                          <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              Weight:
                            </span>
                            <span className="text-xs font-bold text-primary">
                              {item.weight_pct}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {openComments[item.id] && (
                      <div className="bg-slate-50/50 border-t border-slate-100 p-6">
                        <CommentThread
                          submissionId={submission.id}
                          itemId={item.id}
                          itemType={
                            submission.plan_type === "MONTHLY"
                              ? "MONTHLY_PLAN"
                              : "WEEKLY_PLAN"
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ExecutionShell>

        {/* Sticky Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 shadow-2xl z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">
                Finalize Review
              </p>
              <p className="text-xs text-slate-500">
                Provide feedback or approve the execution plan.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant="white"
                className="flex-1 sm:flex-none h-11 px-8 rounded-xl font-bold border-slate-200"
                onClick={handleReject}
                disabled={submitting}
                icon={MdErrorOutline}
              >
                Request Changes
              </Button>
              <Button
                variant="primary"
                className="flex-1 sm:flex-none h-11 px-10 rounded-xl font-bold shadow-lg shadow-primary/20"
                onClick={handleApprove}
                disabled={submitting}
                icon={MdCheckCircle}
              >
                {submitting ? "Processing..." : "Approve Plan"}
              </Button>
            </div>
          </div>
        </div>

        {/* Rejection Feedback Modal */}
        <ConfirmationModal
          isOpen={rejectModalOpen}
          onClose={() => {
            setRejectModalOpen(false);
            setRejectFeedback("");
          }}
          onConfirm={confirmReject}
          title="Request Changes"
          message={
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Please provide feedback explaining why the plan needs changes.
                This will be sent to {submission?.employee_name}.
              </p>
              <textarea
                value={rejectFeedback}
                onChange={(e) => setRejectFeedback(e.target.value)}
                placeholder="Enter your feedback here..."
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                rows={4}
              />
            </div>
          }
          confirmText="Send Feedback & Reject"
          cancelText="Cancel"
          type="danger"
          isLoading={submitting}
        />
      </div>
    </EmployeeLayout>
  );
}
