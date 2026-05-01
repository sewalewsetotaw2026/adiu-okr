import { useState } from "react";
import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";

/** Backend expects `user_id` from the selected team member. */
type EmployeeOption = { id: string; name: string; role?: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  krTitle?: string;
  employees: EmployeeOption[];
  selectedEmployeeId: string | "";
  onSelectEmployee: (id: string | "") => void;
  required: boolean;
  onToggleRequired: (v: boolean) => void;
  onSubmit: () => void;
  loading?: boolean;
};

/** M6 — Assign contributor to a department KR (API integration pending). */
export default function AssignContributorModal({
  isOpen,
  onClose,
  krTitle,
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  required,
  onToggleRequired,
  onSubmit,
  loading,
}: Props) {
  const [search, setSearch] = useState("");
  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Contributor"
      maxWidthClass="max-w-lg"
    >
      <p className="text-sm text-k-medium-grey">
        {krTitle ? (
          <>
            Key Result:{" "}
            <span className="font-semibold text-k-dark-grey">{krTitle}</span>
          </>
        ) : (
          "Select a team member to own execution for this key result."
        )}
      </p>
      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
          Contributor
        </label>
        <div className="mb-2">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/25"
          />
        </div>
        <select
          value={selectedEmployeeId}
          onChange={(e) => {
            const v = e.target.value;
            onSelectEmployee(v === "" ? "" : v);
          }}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Select employee…</option>
          {employees
            .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.role ? ` — ${e.role}` : ""}
              </option>
            ))}
        </select>
      </div>

      <label className="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-k-light-grey/40 px-4 py-3 cursor-pointer transition-colors hover:bg-k-light-grey/60">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => onToggleRequired(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
        />
        <span className="text-sm text-k-dark-grey font-medium">
          Required contributor (blocks closure until complete)
        </span>
      </label>

      <ApprovalFooter
        onCancel={onClose}
        onConfirm={() => {
          if (loading) return;
          onSubmit();
        }}
        confirmText="Assign"
        confirmLoading={loading}
        confirmDisabled={loading || !selectedEmployeeId}
      />
    </ModalLayout>
  );
}
