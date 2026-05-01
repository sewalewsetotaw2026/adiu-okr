import { useEffect, useMemo, useState } from "react";
import ModalLayout from "../ModalLayout";
import ApprovalFooter from "../ApprovalFooter";

export type ArchiveQuarterOption = {
  id: string;
  label: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  options?: ArchiveQuarterOption[];
  onConfirm?: (quarterId: string) => void;
};

const DEFAULT_OPTIONS: ArchiveQuarterOption[] = [
  { id: "q1-2026", label: "Q1 2026" },
  { id: "q4-2025", label: "Q4 2025" },
];

export default function ArchiveQuarterModal({
  isOpen,
  onClose,
  options = DEFAULT_OPTIONS,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState(options[0]?.id ?? "");

  const hasOptions = options.length > 0;

  useEffect(() => {
    if (!hasOptions) {
      setSelected("");
      return;
    }

    const stillExists = options.some((o) => o.id === selected);
    if (!stillExists) {
      setSelected(options[0]?.id ?? "");
    }
  }, [options, selected, hasOptions]);

  const confirmDisabled = useMemo(
    () => !hasOptions || !selected,
    [hasOptions, selected],
  );

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title="Archive quarter"
      footer={
        <ApprovalFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!selected) return;
            onConfirm?.(selected);
            onClose();
          }}
          confirmText="Archive"
          confirmDisabled={confirmDisabled}
        />
      }
    >
      <label className="block text-xs font-medium text-gray-500 mb-1">
        Cycle / quarter
      </label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={!hasOptions}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none"
      >
        {!hasOptions ? (
          <option value="">No closed cycle available</option>
        ) : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </ModalLayout>
  );
}
