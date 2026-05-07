import { useEffect, useState } from "react";
import ModalLayout from "../ModalLayout";
import ApprovalFooter from "../ApprovalFooter";
import BulletTextarea from "../../../../../components/common/BulletTextarea";
import { MdTrackChanges, MdInfoOutline } from "react-icons/md";
import makeCall from "../../../../../API";
import apiRoutes from "../../../../../API/apiRoutes";
import toast from "react-hot-toast";
import { okrUnwrap } from "../../../../../utils/okrApi";

interface EditOkrChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: any;
  entityType: "EMPLOYEE_KR" | "EMPLOYEE_MONTH_PLAN" | "WEEKLY_PLAN";
  companyId: number;
  cycleId: number;
  onSuccess: () => void;
}

export default function EditOkrChangeRequestModal({
  isOpen,
  onClose,
  entity,
  entityType,
  companyId,
  cycleId,
  onSuccess,
}: EditOkrChangeRequestModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    weight: "",
    targetValue: "",
    changeSummary: "",
  });

  useEffect(() => {
    if (isOpen && entity) {
      setForm({
        title: entity.title || "",
        description: entity.description || "",
        weight: String(entity.weight_percent || entity.weight_pct || ""),
        targetValue: String(entity.target_value || ""),
        changeSummary: "",
      });
    }
  }, [isOpen, entity]);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!form.changeSummary.trim()) {
      toast.error("Please explain why you are making this change");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        companyId,
        cycleId,
        entityType,
        entityId: entity.id,
        changeSummary: form.changeSummary,
        newValues: {
          title: form.title,
          description: form.description,
          target_value: Number(form.targetValue) || 0,
          weight_percent: entityType === "EMPLOYEE_KR" ? Number(form.weight) : undefined,
          weight_pct: entityType !== "EMPLOYEE_KR" ? Number(form.weight) : undefined,
        },
      };

      const res = await makeCall({
        method: "POST",
        route: apiRoutes.okr.changeRequests,
        body: payload,
        isSecureRoute: true,
      });

      if (res.status === 201 || res.status === 200) {
        toast.success("Edit request submitted for approval");
        onSuccess();
        onClose();
      } else {
        toast.error(res.data?.message || "Failed to submit edit request");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Published Plan"
      maxWidthClass="max-w-2xl"
      footer={
        <ApprovalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          confirmText={submitting ? "Submitting..." : "Submit for Approval"}
          confirmDisabled={submitting || !form.title.trim() || !form.changeSummary.trim()}
        />
      }
    >
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <MdInfoOutline className="text-amber-600 text-xl mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-900">Approval Required</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              This item is already published. Your changes will be submitted to your manager for approval before taking effect. 
              Subordinates aligned to this plan will also be notified to realign if approved.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <MdTrackChanges className="text-lg" />
            <span>Proposed Changes</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Title</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Target Value</label>
              <input
                type="number"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all"
                value={form.targetValue}
                onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Weight (%)</label>
              <input
                type="number"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Description</label>
            <BulletTextarea
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all min-h-[80px]"
              value={form.description}
              onValueChange={(val) => setForm({ ...form, description: val })}
            />
          </div>

          <div className="space-y-1.5 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider text-primary">Reason for Change</label>
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Required</span>
            </div>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all min-h-[80px]"
              placeholder="Explain why this adjustment is necessary..."
              value={form.changeSummary}
              onChange={(e) => setForm({ ...form, changeSummary: e.target.value })}
            />
          </div>
        </div>
      </div>
    </ModalLayout>
  );
}
