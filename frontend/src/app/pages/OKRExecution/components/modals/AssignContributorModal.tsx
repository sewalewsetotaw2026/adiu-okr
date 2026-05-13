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
  onSubmit,
  loading,
}: Props) {
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
        <select
          value={selectedEmployeeId}
          onChange={(e) => {
            const v = e.target.value;
            onSelectEmployee(v === "" ? "" : v);
          }}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Select employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.role ? ` — ${e.role}` : ""}
            </option>
          ))}
        </select>
      </div>

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
