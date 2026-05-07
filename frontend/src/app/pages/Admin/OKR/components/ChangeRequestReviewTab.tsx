import { useEffect, useState } from "react";
import { MdCheck, MdClose, MdCompareArrows, MdSubtitles, MdTrackChanges, MdMonitorWeight, MdDescription } from "react-icons/md";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import toast from "react-hot-toast";
import { okrUnwrap } from "../../../../utils/okrApi";
import ApprovalActionModal from "../../../OKRExecution/components/modals/ApprovalActionModal";

export default function ChangeRequestReviewTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [modalAction, setModalAction] = useState<"approve" | "reject">("approve");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await makeCall({
        method: "GET",
        route: apiRoutes.okr.changeRequests,
        isSecureRoute: true,
      });
      if (res.status === 200) {
        setRequests(res.data?.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch change requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = (id: number) => {
    setActiveId(id);
    setModalAction("approve");
    setComment("");
    setModalOpen(true);
  };

  const handleReject = (id: number) => {
    setActiveId(id);
    setModalAction("reject");
    setComment("");
    setModalOpen(true);
  };

  const confirmAction = async () => {
    if (!activeId) return;
    if (modalAction === "reject" && !comment.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    setSubmitting(true);
    try {
      await makeCall({
        method: "POST",
        route: `${apiRoutes.okr.changeRequests}/${activeId}/${modalAction}`,
        body: modalAction === "approve" ? { comment } : { reason: comment },
        isSecureRoute: true,
      });
      toast.success(`Edit request ${modalAction === "approve" ? "approved" : "rejected"}`);
      setModalOpen(false);
      fetchRequests();
    } catch (err) {
      toast.error(`Failed to ${modalAction} request`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading requests...</div>;
  if (requests.length === 0) return (
    <div className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 text-gray-300 mb-4">
        <MdCompareArrows className="text-3xl" />
      </div>
      <p className="text-gray-500 font-medium">No pending edit requests.</p>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {requests.map((req) => (
        <div key={req.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                {req.entity_type.replace('_', ' ')}
              </div>
              <span className="text-sm font-semibold text-gray-900">
                Requested by {req.requester?.employee?.full_name || req.requester_id}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReject(req.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <MdClose /> Reject
              </button>
              <button
                onClick={() => handleApprove(req.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                <MdCheck /> Approve
              </button>
            </div>
          </div>

          <div className="p-6">
             <div className="mb-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
               <p className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">Reason for Adjustment</p>
               <p className="text-sm text-blue-800 italic">"{req.change_summary}"</p>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <DiffSection 
                 title="Current Version" 
                 values={req.old_values_json} 
                 type="old" 
               />
               <DiffSection 
                 title="Proposed Version" 
                 values={req.new_values_json} 
                 type="new" 
               />
             </div>
          </div>
        </div>
      ))}
      <ApprovalActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        action={modalAction}
        comment={comment}
        onChangeComment={setComment}
        onConfirm={confirmAction}
        loading={submitting}
        itemSummary={modalAction === "approve" ? "Are you sure you want to approve this edit request?" : "Please provide a reason for rejecting this edit request."}
      />
    </div>
  );
}

function DiffSection({ title, values, type }: { title: string, values: any, type: 'old' | 'new' }) {
  const isNew = type === 'new';
  return (
    <div className={`space-y-4 rounded-2xl p-5 border ${isNew ? 'bg-green-50/30 border-green-100' : 'bg-slate-50/50 border-slate-100'}`}>
      <h4 className={`text-xs font-bold uppercase tracking-widest ${isNew ? 'text-green-700' : 'text-slate-500'}`}>
        {title}
      </h4>
      
      <div className="space-y-3">
        <DiffItem icon={<MdSubtitles/>} label="Title" value={values.title} />
        <DiffItem icon={<MdMonitorWeight/>} label="Weight" value={`${values.weight_percent || values.weight_pct}%`} />
        <DiffItem icon={<MdTrackChanges/>} label="Target" value={values.target_value} />
        <DiffItem icon={<MdDescription/>} label="Description" value={values.description} isMultiline />
      </div>
    </div>
  );
}

function DiffItem({ icon, label, value, isMultiline }: { icon: any, label: string, value: any, isMultiline?: boolean }) {
  if (!value && value !== 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        {icon} <span>{label}</span>
      </div>
      <div className={`text-sm text-gray-700 ${isMultiline ? 'bg-white/50 p-2 rounded-lg border border-gray-100 line-clamp-3' : 'font-medium'}`}>
        {value}
      </div>
    </div>
  );
}
