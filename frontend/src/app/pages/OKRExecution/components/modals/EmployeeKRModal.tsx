import { useState } from "react";
import { MdGroupAdd } from "react-icons/md";
import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";
import BulletTextarea from "../../../../components/common/BulletTextarea";
import Button from "../../../../components/Core/ui/Button";

export type MetricPick = {
  id: number;
  name: string;
  unit_of_measure?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialTitle: string;
  initialDescription: string;
  onChangeTitle: (v: string) => void;
  onChangeDescription: (v: string) => void;
  metricDefinitions: MetricPick[];
  metricDefinitionId: number | "";
  onChangeMetricDefinitionId: (id: number | "") => void;
  targetValue: number | "";
  onChangeTargetValue: (v: number | "") => void;
  unitOfMeasure: string;
  onChangeUnitOfMeasure: (v: string) => void;
  weightPercent: number;
  onChangeWeightPercent: (v: number) => void;
  onSubmit: () => void;
  isEdit: boolean;
  submitting?: boolean;
  onAssignContributor?: () => void;
  teamMembers?: Array<{ id: string; name: string }>;
  assignedEmployeeIds?: string[];
  lockedEmployeeIds?: string[];
  onChangeAssignedEmployees?: (ids: string[]) => void;
  objectiveTitle?: string;
};

/** Create / edit employee KR (matches POST/PUT `/okr/employee/.../key-results`). */
export default function EmployeeKRModal({
  isOpen,
  onClose,
  initialTitle,
  initialDescription,
  onChangeTitle,
  onChangeDescription,
  metricDefinitions,
  metricDefinitionId,
  onChangeMetricDefinitionId,
  targetValue,
  onChangeTargetValue,
  unitOfMeasure,
  onChangeUnitOfMeasure,
  weightPercent,
  onChangeWeightPercent,
  onSubmit,
  isEdit,
  submitting,
  onAssignContributor,
  teamMembers,
  assignedEmployeeIds,
  lockedEmployeeIds,
  onChangeAssignedEmployees,
  objectiveTitle,
}: Props) {
  const [search, setSearch] = useState("");
  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Key Result" : "New Key Result"}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        {/*{objectiveTitle && (
          <p className="text-xs text-gray-500 mb-2">
            This key result belongs to{" "}
            <span className="font-medium text-gray-800">{objectiveTitle}</span>.
            You can use a single key result to work directly on the objective,
            or add multiple to break it down into smaller outcomes. Your plans
            and progress will be organized under these key results.
          </p>
        )}*/}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Title
          </label>
          <input
            value={initialTitle}
            onChange={(e) => onChangeTitle(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Measurable Outcome"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Description
          </label>
          <BulletTextarea
            value={initialDescription}
            onValueChange={onChangeDescription}
            className="min-h-[100px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="How Success Is Defined"
          />
        </div>
        {!isEdit && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Metric
            </label>
            <select
              value={
                metricDefinitionId === "" ? "" : String(metricDefinitionId)
              }
              onChange={(e) => {
                const v = e.target.value;
                onChangeMetricDefinitionId(v === "" ? "" : Number(v));
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select Metric...</option>
              {metricDefinitions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.unit_of_measure ? ` (${m.unit_of_measure})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Target Value
            </label>
            <input
              type="number"
              value={targetValue === "" ? "" : targetValue}
              onChange={(e) => {
                const raw = e.target.value;
                onChangeTargetValue(raw === "" ? "" : Number(raw));
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Unit Of Measure
            </label>
            <input
              value={unitOfMeasure}
              onChange={(e) => onChangeUnitOfMeasure(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="%"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-k-medium-grey tracking-wide">
            Weight %
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={weightPercent}
            onChange={(e) =>
              onChangeWeightPercent(
                Math.min(100, Math.max(0, Number(e.target.value) || 0)),
              )
            }
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {teamMembers && teamMembers.length > 0 && (
          <div>
            <label className="mb-2 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Assigned Employees
            </label>
            <div className="mb-2">
              <input
                type="text"
                placeholder="Search team members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/25"
              />
            </div>
            <div className="max-h-40 overflow-auto rounded-xl border border-gray-200 bg-white p-3 space-y-2">
              {teamMembers
                .filter(tm => tm.name.toLowerCase().includes(search.toLowerCase()))
                .map((tm) => {
                const checked = (assignedEmployeeIds || []).includes(tm.id);
                const isLocked = (lockedEmployeeIds || []).includes(tm.id);
                return (
                  <label
                    key={tm.id}
                    className="flex cursor-pointer items-center gap-2 rounded p-1 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isLocked}
                      title={isLocked ? "Already adopted" : ""}
                      onChange={(e) => {
                        if (!onChangeAssignedEmployees) return;
                        const next = e.target.checked
                          ? [...(assignedEmployeeIds || []), tm.id]
                          : (assignedEmployeeIds || []).filter(
                              (id) => id !== tm.id,
                            );
                        onChangeAssignedEmployees(next);
                      }}
                      className={`h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                    <span className="font-medium">{tm.name}</span>
                  </label>
                );
              })}
            </div>
            {/*<p className="text-[10px] text-gray-400 italic mt-2">
              Assigning an employee will create a corresponding objective for
              them once the plan is submitted and approved.
            </p>*/}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
        {/*{onAssignContributor ? (
          <Button
            variant="ghost"
            size="sm"
            icon={MdGroupAdd}
            onClick={onAssignContributor}
          >
            Assign contributor
          </Button>
        ) : (
          <span />
        )}*/}
        <ApprovalFooter
          onCancel={onClose}
          onConfirm={onSubmit}
          confirmText={isEdit ? "Save" : "Create"}
          confirmLoading={submitting}
          confirmDisabled={submitting}
        />
      </div>
    </ModalLayout>
  );
}
