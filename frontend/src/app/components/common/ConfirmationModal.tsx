import React from "react";
import { FiAlertTriangle } from "react-icons/fi";
import Button from "../Core/ui/Button";
import Modal from "./Modal";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger",
  isLoading = false,
}: ConfirmationModalProps) {
  const typeConfig = {
    danger: {
      icon: <FiAlertTriangle className="text-red-600 text-3xl" />,
      iconBg: "bg-red-100",
      buttonVariant: "danger" as const,
    },
    warning: {
      icon: <FiAlertTriangle className="text-yellow-600 text-3xl" />,
      iconBg: "bg-yellow-100",
      buttonVariant: "primary" as const,
    },
    info: {
      icon: <FiAlertTriangle className="text-blue-600 text-3xl" />,
      iconBg: "bg-blue-100",
      buttonVariant: "primary" as const,
    },
  };

  const config = typeConfig[type] || typeConfig.danger;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
    >
      <div className="animate-[fadeIn_0.2s_ease-out]">
        <div className="flex items-start gap-4 mb-6">
          <div className={`w-12 h-12 ${config.iconBg} rounded-full flex items-center justify-center shrink-0`}>
            {config.icon}
          </div>
          <div>
            <p className="text-gray-500 font-medium leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
          <Button
            onClick={onClose}
            variant="secondary"
            className="px-6"
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            variant={config.buttonVariant}
            className="px-6"
            loading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
