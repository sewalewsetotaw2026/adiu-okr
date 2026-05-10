import ModalLayout from "../../../Admin/OKR/components/ModalLayout";
import ApprovalFooter from "../../../Admin/OKR/components/ApprovalFooter";
import BulletTextarea from "../../../../components/common/BulletTextarea";
import Toggle from "../../../../components/Core/ui/Toggle";
import { useMemo } from "react";
import { MdPerson } from "react-icons/md";

export type MetricPick = {
  id: number;
  name: string;
  unit_of_measure?: string;
  allows_binary_completion?: boolean;
  requires_target_value?: boolean;
  value_based_progress?: boolean;
  is_financial?: boolean;
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
  contributesToScore?: boolean;
  contributesToValue?: boolean;
  onChangeContributesToScore?: (v: boolean) => void;
  onChangeContributesToValue?: (v: boolean) => void;
  teamMembers?: Array<{ id: string; name: string }>;
  assignedEmployeeIds?: string[];
  lockedEmployeeIds?: string[];
  onChangeAssignedEmployees?: (ids: string[]) => void;
  objectiveTitle?: string;
  // Self-assign and contribution distribution
  assignToSelfOnly?: boolean;
  onChangeAssignToSelfOnly?: (v: boolean) => void;
  currentUserName?: string;
  assigneeDetails?: Record<string, { target: string; weight: string }>;
  onChangeAssigneeDetail?: (id: string, field: "target" | "weight", value: string) => void;
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
  contributesToScore = true,
  contributesToValue = true,
  onChangeContributesToScore,
  onChangeContributesToValue,
  teamMembers,
  assignedEmployeeIds,
  lockedEmployeeIds,
  onChangeAssignedEmployees,
  assignToSelfOnly = false,
  onChangeAssignToSelfOnly,
  currentUserName,
  assigneeDetails = {},
  onChangeAssigneeDetail,
}: Props) {
  const selectedMetric = useMemo(
    () =>
      metricDefinitions.find((m) => m.id === Number(metricDefinitionId)) ||
      null,
    [metricDefinitions, metricDefinitionId],
  );
  const isBinaryMetric = !!selectedMetric?.allows_binary_completion;

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
            className="min-h-25 w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-k-dark-grey outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
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
          {!isBinaryMetric && (
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
          )}
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
        {isBinaryMetric && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs font-semibold text-blue-700">
            This metric is binary. Numeric target/current values are not
            required.
          </div>
        )}
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

        <div className="pt-2 flex flex-col gap-3">
          {!selectedMetric?.value_based_progress && (
            <Toggle
              label="Contribute to Score"
              description="Progress affects the overall objective score"
              checked={contributesToScore}
              onChange={(val: boolean) => onChangeContributesToScore?.(val)}
            />
          )}

          {!selectedMetric?.is_financial && (
            <Toggle
              label="Contribute to Value"
              description="Numeric progress contributes to the objective target"
              checked={contributesToValue}
              onChange={(val: boolean) => onChangeContributesToValue?.(val)}
            />
          )}
        </div>

        {teamMembers && teamMembers.length > 0 && (
          <div>
            <label className="mb-2 block text-xs font-semibold text-k-medium-grey tracking-wide">
              Assigned Employees
            </label>

            {/* Assign to Self Only */}
            {onChangeAssignToSelfOnly && (
              <label className="flex items-center gap-3 mb-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={assignToSelfOnly}
                  onChange={(e) => onChangeAssignToSelfOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20 accent-primary"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                    <MdPerson className="text-primary" /> Assign to Self Only
                  </p>
                  {currentUserName && (
                    <p className="text-[10px] text-gray-400">{currentUserName}</p>
                  )}
                </div>
              </label>
            )}

            {!assignToSelfOnly && (
              <div className="max-h-52 overflow-auto rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                {teamMembers.map((tm) => {
                  const checked = (assignedEmployeeIds || []).includes(tm.id);
                  const isLocked = (lockedEmployeeIds || []).includes(tm.id);
                  const detail = assigneeDetails[tm.id] || { target: "", weight: "" };
                  const multiOwner = (assignedEmployeeIds || []).length > 1;
                  return (
                    <div key={tm.id} className="space-y-2">
                      <label className="flex cursor-pointer items-center gap-2 rounded p-1 text-xs text-gray-700 transition-colors hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isLocked}
                          title={isLocked ? "Already adopted" : ""}
                          onChange={(e) => {
                            if (!onChangeAssignedEmployees) return;
                            const next = e.target.checked
                              ? [...(assignedEmployeeIds || []), tm.id]
                              : (assignedEmployeeIds || []).filter((id) => id !== tm.id);
                            onChangeAssignedEmployees(next);
                          }}
                          className={`h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                        />
                        <span className={`font-medium ${checked ? "text-primary" : ""}`}>{tm.name}</span>
                      </label>

                      {/* Per-assignee contribution inputs shown when >1 selected */}
                      {checked && multiOwner && !isBinaryMetric && onChangeAssigneeDetail && (
                        <div className="ml-6 grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                              Target
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={detail.target}
                              onChange={(e) => onChangeAssigneeDetail(tm.id, "target", e.target.value)}
                              className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-primary focus:ring-0 transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                              Weight (%)
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={detail.weight}
                              onChange={(e) => onChangeAssigneeDetail(tm.id, "weight", e.target.value)}
                              className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-primary focus:ring-0 transition-all"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
