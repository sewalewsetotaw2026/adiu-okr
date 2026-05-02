type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Tailwind max-width class, e.g. max-w-lg, max-w-2xl */
  maxWidthClass?: string;
};

export default function ModalLayout({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = "max-w-lg",
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* BACKDROP */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* MODAL */}
      <div
        className={`relative bg-white rounded-2xl shadow-xl shadow-black/10 w-full ${maxWidthClass} max-h-[90vh] overflow-hidden flex flex-col p-6 z-10`}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1 -mr-1">
          {children}
        </div>

        {/* FOOTER */}
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}
