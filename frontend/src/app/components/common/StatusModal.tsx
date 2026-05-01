import React from "react";
import { MdCheckCircle, MdWarning, MdInfo, MdError } from "react-icons/md";
import Button from "../Core/ui/Button";
import Modal from "./Modal";

/**
 * StatusModal - A reusable modal for success, warning, error, and info messages.
 */
export default function StatusModal({ 
  isOpen, 
  onClose, 
  type = "success",
  title, 
  message,
  primaryButtonText = "Close",
  onPrimaryAction,
  secondaryButtonText,
  onSecondaryAction
}: {
  isOpen: boolean;
  onClose: () => void;
  type?: "success" | "warning" | "error" | "info";
  title: string;
  message: string;
  primaryButtonText?: string;
  onPrimaryAction?: () => void;
  secondaryButtonText?: string;
  onSecondaryAction?: () => void;
}) {
  const iconConfig = {
    success: { icon: MdCheckCircle, bgColor: "bg-green-50", iconColor: "text-success" },
    warning: { icon: MdWarning, bgColor: "bg-yellow-50", iconColor: "text-warning" },
    error: { icon: MdError, bgColor: "bg-red-50", iconColor: "text-error" },
    info: { icon: MdInfo, bgColor: "bg-blue-50", iconColor: "text-info" },
  };

  const config = iconConfig[type] || iconConfig.success;
  const Icon = config.icon;

  const handlePrimaryClick = () => {
    if (onPrimaryAction) {
      onPrimaryAction();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="text-center animate-[fadeIn_0.2s_ease-out]">
        <div className={`w-20 h-20 ${config.bgColor} rounded-full flex items-center justify-center mx-auto mb-6 ${config.iconColor}`}>
          <Icon className="text-5xl" />
        </div>
        
        <p className="text-k-medium-grey mb-8 font-medium">{message}</p>
        
        <div className={`flex ${secondaryButtonText ? 'gap-4' : ''}`}>
          {secondaryButtonText && (
            <Button 
              onClick={onSecondaryAction || onClose}
              variant="secondary"
              className="w-full"
            >
              {secondaryButtonText}
            </Button>
          )}
          <Button 
            onClick={handlePrimaryClick}
            variant="primary"
            className="w-full"
          >
            {primaryButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
