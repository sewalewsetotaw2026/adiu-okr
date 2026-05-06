import Button, { type ButtonVariant } from "../../../../components/Core/ui/Button";

type Props = {
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  confirmVariant?: ButtonVariant;
  className?: string;
};

export default function ApprovalFooter({
  onCancel,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmDisabled,
  confirmLoading = false,
  confirmVariant = "primary",
  className = "",
}: Props) {
  return (
    <div
      className={`flex flex-col-reverse sm:flex-row sm:justify-end gap-3 ${className}`}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={onCancel}
        disabled={confirmLoading}
      >
        {cancelText}
      </Button>

      <Button
        variant={confirmVariant}
        size="sm"
        onClick={onConfirm}
        disabled={confirmDisabled}
        loading={confirmLoading}
      >
        {confirmText}
      </Button>
    </div>
  );
}
