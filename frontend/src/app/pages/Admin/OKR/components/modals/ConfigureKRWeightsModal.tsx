import { useEffect, useMemo, useState } from "react";
import ModalLayout from "../ModalLayout";
import ApprovalFooter from "../ApprovalFooter";

export type KrWeightRow = { id: number; name: string; weight: number };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  rows?: KrWeightRow[];
  onSave?: (rows: KrWeightRow[]) => void;
};

const DEFAULT_ROWS: KrWeightRow[] = [
  { id: 1, name: "Dimension A", weight: 25 },
  { id: 2, name: "Dimension B", weight: 25 },
  { id: 3, name: "Dimension C", weight: 25 },
  { id: 4, name: "Dimension D", weight: 25 },
];

export default function ConfigureKRWeightsModal({
  isOpen,
  onClose,
  rows = DEFAULT_ROWS,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<KrWeightRow[]>(rows);
  useEffect(() => {
    if (isOpen) setDraft(rows);
  }, [isOpen, rows]);
  const total = useMemo(
    () => draft.reduce((s, r) => s + Number(r.weight || 0), 0),
    [draft],
  );
  const valid = total === 100;

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title="Configure KR weights"
      maxWidthClass="max-w-xl"
      footer={
        <ApprovalFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!valid) return;
            onSave?.(draft);
            onClose();
          }}
          confirmText={valid ? "Save" : "Total must be 100%"}
        />
      }
    >
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2 font-semibold text-gray-700">KR / group</th>
            <th className="px-3 py-2 font-semibold text-gray-700 w-28">%</th>
          </tr>
        </thead>
        <tbody>
          {draft.map((row) => (
            <tr key={row.id} className="border-t border-gray-100">
              <td className="px-3 py-2 text-gray-900">{row.name}</td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={row.weight}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0);
                    setDraft((p) =>
                      p.map((x) => (x.id === row.id ? { ...x, weight: v } : x)),
                    );
                  }}
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p
        className={`text-xs font-medium ${valid ? "text-emerald-700" : "text-amber-700"}`}
      >
        Total: {total}%
      </p>
    </ModalLayout>
  );
}
