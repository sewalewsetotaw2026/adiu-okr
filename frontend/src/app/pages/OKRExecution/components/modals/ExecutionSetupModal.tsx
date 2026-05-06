import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";
import BulletTextarea from "../../../../components/common/BulletTextarea";

export type EmployeeAdoptionMode = "direct_adoption" | "custom_adoption";

export type AdoptableOption = {
  id: number;
  title: string;
  description: string;
  parentContext?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;

  /** List of assigned KRs available to adopt. */
  options: AdoptableOption[];
  selectedId: number | null;
  onSelectId: (id: number) => void;

  mode: EmployeeAdoptionMode;
  onChangeMode: (m: EmployeeAdoptionMode) => void;

  customTitle: string;
  customDescription: string;
  onChangeCustomTitle: (v: string) => void;
  onChangeCustomDescription: (v: string) => void;

  onConfirm: () => void;
  saving?: boolean;
};

export default function ExecutionSetupModal({
  isOpen,
  onClose,
  options,
  selectedId,
  onSelectId,
  mode,
  onChangeMode,
  customTitle,
  customDescription,
  onChangeCustomTitle,
  onChangeCustomDescription,
  onConfirm,
  saving,
}: Props) {
  const selectedOption = options.find((o) => o.id === selectedId);
  const parentTitle = selectedOption?.title || "";
  const parentDescription = selectedOption?.description || "";

  const displayTitle = mode === "direct_adoption" ? parentTitle : customTitle;
  const displayDescription =
    mode === "direct_adoption" ? parentDescription : customDescription;

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title={parentTitle ? `Adopt KR: ${parentTitle}` : "Adopt Assigned KR"}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-6">
        {/* Dropdown for picking which KR to adopt */}
        <div>
          <label className="mb-1.5 block text-xs font-bold text-gray-400 tracking-widest">
            Assigned Key Result
          </label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => onSelectId(Number(e.target.value))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
          >
            <option value="" disabled>
              Select a Key Result to Adopt...
            </option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.title} {opt.parentContext ? `(${opt.parentContext})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Adoption Mode Selection */}
          <div className="bg-slate-50/50 p-4 rounded-2xl ring-1 ring-slate-100">
            <label className="mb-3 block text-xs font-bold text-gray-400 tracking-widest">
              Adoption Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onChangeMode("direct_adoption");
                  if (selectedOption) {
                    onChangeCustomTitle(selectedOption.title);
                    onChangeCustomDescription(selectedOption.description);
                  }
                }}
                className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${
                  mode === "direct_adoption"
                    ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span className="text-sm font-bold text-k-dark-grey">Direct</span>
                <span className="text-[10px] text-k-medium-grey leading-relaxed">
                  Use manager's title & description.
                </span>
              </button>

              <button
                type="button"
                onClick={() => onChangeMode("custom_adoption")}
                className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${
                  mode === "custom_adoption"
                    ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span className="text-sm font-bold text-k-dark-grey">Custom</span>
                <span className="text-[10px] text-k-medium-grey leading-relaxed">
                  Define your own title & description.
                </span>
              </button>
            </div>
          </div>

          {/* Dynamic Fields */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-400 tracking-widest">
                Objective Title
              </label>
              <input
                value={displayTitle}
                onChange={(e) => onChangeCustomTitle(e.target.value)}
                disabled={mode === "direct_adoption" || !selectedId}
                placeholder={!selectedId ? "No KR Selected" : "Name Your Achievement..."}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-400 tracking-widest">
                Objective Description
              </label>
              <BulletTextarea
                value={displayDescription}
                onValueChange={onChangeCustomDescription}
                disabled={mode === "direct_adoption" || !selectedId}
                placeholder={!selectedId ? "Description Will Be Synced From Manager's KR." : "Explain The Context And Success Criteria..."}
                className="min-h-[120px] w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      <ApprovalFooter
        onCancel={onClose}
        onConfirm={onConfirm}
        confirmText="Create Objective"
        confirmLoading={saving}
        confirmDisabled={
          saving ||
          !selectedId ||
          (mode === "custom_adoption" && !customTitle.trim())
        }
      />
    </ModalLayout>
  );
}
