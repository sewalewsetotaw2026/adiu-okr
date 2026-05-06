import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmployeeLayout from "../../../components/DefaultLayout/EmployeeLayout";
import ExecutionShell from "../components/ExecutionShell";
import Button from "../../../components/Core/ui/Button";
import { MdFactCheck, MdArrowBack, MdCheckCircle, MdCancel, MdCompareArrows } from "react-icons/md";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import ToastService from "../../../../utils/ToastService";
import { okrErrorMessage } from "../../../utils/okrApi";
import ConfirmationModal from "../../../components/common/ConfirmationModal";

export default function ChangeRequestReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cr, setCr] = useState<any>(null);

  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [comment, setComment] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.changeRequests.detail(id!),
        isSecureRoute: true,
      });
      setCr(res?.data?.data || res?.data);
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
      navigate("/okr/reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void loadData();
  }, [id]);

  const handleAction = async (action: "approve" | "reject") => {
    if (action === "reject" && !comment.trim()) {
      ToastService.error("A reason is required to reject a change request.");
      return;
    }
    setSubmitting(true);
    try {
      const route = action === "approve" 
        ? apiRoutes.okr.changeRequests.approve(id!) 
        : apiRoutes.okr.changeRequests.reject(id!);
      
      await makeCall({
        method: "POST",
        route,
        body: { comment },
        isSecureRoute: true,
      });
      
      ToastService.success(`Change request ${action === "approve" ? "approved" : "rejected"} successfully.`);
      navigate("/okr/reviews");
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setSubmitting(false);
      setShowApprove(false);
      setShowReject(false);
    }
  };

  const renderDiffViewer = () => {
    if (!cr) return null;
    
    // Safety check for legacy or malformed CRs without new/old values
    if (!cr.new_values_json) {
      return (
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-700 text-sm">
          Detailed change comparison is not available for this request.
        </div>
      );
    }

    const newValues = typeof cr.new_values_json === 'string' ? JSON.parse(cr.new_values_json) : cr.new_values_json;
    const oldValues = typeof cr.old_values_json === 'string' && cr.old_values_json ? JSON.parse(cr.old_values_json) : (cr.old_values_json || {});

    // Get all keys present in newValues
    const keys = Object.keys(newValues);

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <MdCompareArrows className="text-primary" />
          Change Comparison
        </h3>
        
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200 px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div>Field</div>
            <div>Original Value</div>
            <div>Requested Value</div>
          </div>
          <div className="divide-y divide-slate-100">
            {keys.map((key) => {
              const oldVal = oldValues[key];
              const newVal = newValues[key];
              const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

              if (!isChanged && oldVal === undefined) return null; // Skip if not present in both and unchanged

              return (
                <div key={key} className={`grid grid-cols-3 px-4 py-4 text-sm ${isChanged ? 'bg-amber-50/30' : ''}`}>
                  <div className="font-semibold text-slate-700 capitalize break-words pr-4">
                    {key.replace(/_/g, ' ')}
                    {isChanged && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-400"></span>}
                  </div>
                  <div className="text-slate-500 break-words pr-4">
                    {oldVal !== undefined && oldVal !== null ? String(oldVal) : <span className="text-slate-300 italic">None</span>}
                  </div>
                  <div className={`font-medium break-words ${isChanged ? 'text-amber-700' : 'text-slate-700'}`}>
                    {newVal !== undefined && newVal !== null ? String(newVal) : <span className="text-slate-300 italic">None</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <EmployeeLayout>
      <div className="min-h-screen bg-slate-50/50 -mx-4 md:-mx-8 px-4 md:px-8 pb-12">
        <div className="pt-6 pb-4">
          <Button
            variant="ghost"
            icon={MdArrowBack}
            onClick={() => navigate("/okr/reviews")}
            className="text-slate-500 hover:text-slate-800 -ml-2"
          >
            Back to Dashboard
          </Button>
        </div>

        <ExecutionShell
          breadcrumbs={[
            { label: "OKR Management" },
            { label: "Review Dashboard", path: "/okr/reviews" },
            { label: "Change Request Review" },
          ]}
          title="Review Change Request"
          subtitle="Review the requested modifications and approve or reject the changes."
          icon={<MdFactCheck className="text-2xl" />}
        >
          {loading ? (
             <div className="py-20 flex justify-center">
               <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
             </div>
          ) : !cr ? (
            <div className="py-20 text-center text-slate-500">Change request not found.</div>
          ) : (
            <div className="space-y-8 max-w-5xl mx-auto">
              
              {/* Header Info Card */}
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 justify-between items-start">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest font-space rounded-lg">
                      {cr.entity_type.replace(/_/g, ' ')} EDIT
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Requested {new Date(cr.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">
                      Edit Request from {cr.requester?.user?.employee?.first_name || cr.requester?.first_name} {cr.requester?.user?.employee?.last_name || cr.requester?.last_name}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                      Entity ID: {cr.entity_id}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <Button
                    variant="outline"
                    icon={MdCancel}
                    onClick={() => setShowReject(true)}
                    className="!border-rose-200 !text-rose-600 hover:!bg-rose-50"
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    icon={MdCheckCircle}
                    onClick={() => setShowApprove(true)}
                    className="shadow-md shadow-primary/20"
                  >
                    Approve Changes
                  </Button>
                </div>
              </div>

              {/* Diff Viewer */}
              {renderDiffViewer()}
              
              {/* Cascade Info Banner (Optional) */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 flex items-start gap-3">
                <div className="mt-0.5">
                  <MdFactCheck className="text-blue-500 text-xl" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-900">Cascading Realignment</h4>
                  <p className="text-xs text-blue-700/80 mt-1 leading-relaxed max-w-3xl">
                    Approving this change will automatically flag any connected subordinate plans (like Weekly or Daily plans) that align with this entity. Subordinates will be notified to review and realign their plans with these new changes.
                  </p>
                </div>
              </div>

            </div>
          )}
        </ExecutionShell>
      </div>

      {/* APPROVE MODAL */}
      <ConfirmationModal
        isOpen={showApprove}
        onClose={() => setShowApprove(false)}
        title="Approve Change Request"
        message="Are you sure you want to approve these changes? This will permanently modify the entity and may trigger realignment flags for subordinates."
        confirmText={submitting ? "Approving..." : "Approve"}
        onConfirm={() => handleAction("approve")}
      >
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Approval Comment (Optional)
          </label>
          <textarea
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm focus:border-primary focus:ring-0"
            rows={3}
            placeholder="Add a note..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </ConfirmationModal>

      {/* REJECT MODAL */}
      <ConfirmationModal
        isOpen={showReject}
        onClose={() => setShowReject(false)}
        title="Reject Change Request"
        message="Please provide a reason for rejecting this change request."
        confirmText={submitting ? "Rejecting..." : "Reject"}
        type="danger"
        onConfirm={() => handleAction("reject")}
      >
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Rejection Reason (Required)
          </label>
          <textarea
            className="w-full rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-sm focus:border-rose-500 focus:ring-0"
            rows={3}
            placeholder="Explain why this was rejected..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </ConfirmationModal>

    </EmployeeLayout>
  );
}
