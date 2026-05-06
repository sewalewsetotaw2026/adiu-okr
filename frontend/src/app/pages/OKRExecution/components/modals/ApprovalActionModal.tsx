import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";
import BulletTextarea from "../../../../components/common/BulletTextarea";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  itemSummary: string;
  action: "approve" | "reject" | "publish";
  comment: string;
  onChangeComment: (v: string) => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
};

/** M12 — Approve / reject / publish (manager). */
export default function ApprovalActionModal({
  isOpen,
  onClose,
  itemSummary,
  action,
  comment,
  onChangeComment,
  onConfirm,
  loading,
}: Props) {
  const title =
    action === "approve"
      ? "Approve submission"
      : action === "reject"
        ? "Reject submission"
        : "Publish";

  const confirmVariant =
    action === "approve"
      ? "success"
      : action === "reject"
        ? "danger"
        : "primary";

  const confirmText =
    action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Publish";

  return (
    <ModalLayout isOpen={isOpen} onClose={onClose} title={title} maxWidthClass="max-w-lg">
      <p className="text-sm text-k-dark-grey">{itemSummary}</p>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey uppercase tracking-wide">
          Comment {action === "reject" ? <span className="text-error">*</span> : null}
        </label>
        <BulletTextarea
          value={comment}
          onValueChange={(val) => onChangeComment(val)}
          placeholder={
            action === "reject"
              ? "Explain the reason for rejection…"
              : "Optional comment…"
          }
          className="min-h-[110px] w-full resize-y rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-k-dark-grey placeholder:text-k-medium-grey outline-none transition-colors duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
      </div>
      <ApprovalFooter
        onCancel={onClose}
        onConfirm={() => {
          if (loading) return;
          void onConfirm();
        }}
        confirmText={confirmText}
        confirmVariant={confirmVariant}
        confirmLoading={loading}
      />
    </ModalLayout>
  );
}
