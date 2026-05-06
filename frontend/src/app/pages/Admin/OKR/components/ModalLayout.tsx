import Button from "../../../../components/Core/ui/Button";
import { MdClose } from "react-icons/md";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Tailwind max-width class, e.g. max-w-lg, max-w-2xl */
  maxWidthClass?: string;
  /** If true, the modal will take up the full available height */
  fullHeight?: boolean;
};

export default function ModalLayout({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = "max-w-lg",
  fullHeight = false,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* BACKDROP */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative bg-white rounded-2xl shadow-xl shadow-black/10 w-full ${maxWidthClass} ${
          fullHeight ? "h-full" : "max-h-[90vh]"
        } overflow-hidden flex flex-col z-10`}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800 capitalize">{title}</h2>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 !p-2 h-auto"
            icon={MdClose}
          />
        </div>

        {/* BODY */}
        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 px-6 pb-2">
          {children}
        </div>

        {/* STICKY FOOTER */}
        {footer && (
          <div className="shrink-0 px-6 pb-6 pt-2 bg-white border-t border-gray-100 sticky bottom-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
