import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import ModalLayout from "./ModalLayout";
import ApprovalFooter from "./ApprovalFooter";
import BulletTextarea from "../../../../components/common/BulletTextarea";
import { MdSend, MdSearch, MdGroups, MdOutlineHub, MdTrackChanges, MdBusiness } from "react-icons/md";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import toast from "react-hot-toast";
import { okrErrorMessage, okrUnwrap } from "../../../../utils/okrApi";
import { selectDepartments, selectDepartmentsLoading } from "../../Departments/slice/selectors";

interface KRModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectiveId: number | string;
  editingKR?: any;
  assignmentType: "employee" | "department" | "company";
  onSuccess: () => void;
}


type MetricDefinitionOption = {
  id: number;
  name: string;
  unit_of_measure?: string;
  allows_binary_completion?: boolean;
  requires_target_value?: boolean;
};

export default function KRModal({
  isOpen,
  onClose,
  objectiveId,
  editingKR,
  assignmentType,
  onSuccess,
}: KRModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [metricDefinitions, setMetricDefinitions] = useState<MetricDefinitionOption[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    weight: "",
    targetValue: "",
    unitOfMeasure: "",
    metricDefinitionId: "",
    assignedIds: [] as any[],
    contributesToScore: true,
    contributesToValue: true,
    chosenParentKrId: null as number | null,
  });

  const reduxDepartments = useSelector(selectDepartments) as any[];
  const depsLoading = useSelector(selectDepartmentsLoading);

  // Reset form when modal opens/changes
  useEffect(() => {
    if (isOpen) {
      if (editingKR) {
        setForm({
          title: editingKR.title || "",
          description: editingKR.description || "",
          weight: String(editingKR.weight_percent || editingKR.weightPercent || ""),
          targetValue: String(editingKR.target_value || editingKR.targetValue || ""),
          unitOfMeasure: editingKR.unit_of_measure || editingKR.unitOfMeasure || "",
          metricDefinitionId: String(editingKR.metric_definition_id || editingKR.metricDefinitionId || ""),
          assignedIds: assignmentType === "employee" 
            ? collectEmployeeIdsFromKr(editingKR)
            : (editingKR.departments || editingKR.assignedDepartments || []).map((d: any) => d.id || d),
          contributesToScore: editingKR.contributes_to_score !== false,
          contributesToValue: editingKR.contributes_to_value !== false,
          chosenParentKrId: editingKR.chosen_parent_kr_id || editingKR.chosenParentKrId || null,
        });
      } else {
        setForm({
          title: "",
          description: "",
          weight: "",
          targetValue: "",
          unitOfMeasure: "",
          metricDefinitionId: "",
          assignedIds: [],
          contributesToScore: true,
          contributesToValue: true,
          chosenParentKrId: null,
        });
      }
      setSearchTerm("");
    }
  }, [isOpen, editingKR, assignmentType]);

  // Load metric definitions only (departments come from Redux)
  useEffect(() => {
    if (isOpen) {
      const loadMetricDefs = async () => {
        try {
          const metricRes = await makeCall({
            method: "GET",
            route: apiRoutes.okr.companyMetrics,
            isSecureRoute: true,
          });
          setMetricDefinitions(okrUnwrap(metricRes) || []);
        } catch (err) {
          console.error("Failed to load metric definitions:", err);
        }
      };
      void loadMetricDefs();
    }
  }, [isOpen]);

  // Load employees for employee assignment type
  useEffect(() => {
    if (isOpen && assignmentType === "employee") {
      const loadEmployees = async () => {
        setLoading(true);
        try {
          const teamRes = await makeCall({
            method: "GET",
            route: apiRoutes.manager.team,
            isSecureRoute: true,
          });
          const data = okrUnwrap(teamRes) as any;
          setAssignments(Array.isArray(data) ? data : (data?.teamMembers || []));
        } catch (err) {
          console.error("Failed to load employees:", err);
        } finally {
          setLoading(false);
        }
      };
      void loadEmployees();
    }
  }, [isOpen, assignmentType]);

  // Use Redux departments for department/company assignment
  const departmentAssignments = useMemo(() => {
    if (assignmentType === "department" || assignmentType === "company") {
      return Array.isArray(reduxDepartments) ? reduxDepartments : [];
    }
    return assignments;
  }, [assignmentType, reduxDepartments, assignments]);

  const filteredAssignments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const sourceList = (assignmentType === "department" || assignmentType === "company") 
      ? departmentAssignments 
      : assignments;
    if (!q) return sourceList;
    return sourceList.filter((item) => {
      if (assignmentType === "employee") {
        const name = String(item.employee?.full_name || "").toLowerCase();
        const title = String(item.jobTitle?.title || "").toLowerCase();
        const dept = String(item.department?.name || "").toLowerCase();
        return name.includes(q) || title.includes(q) || dept.includes(q);
      } else {
        const name = String(item.name || "").toLowerCase();
        const code = String(item.department_code || "").toLowerCase();
        return name.includes(q) || code.includes(q);
      }
    });
  }, [assignments, departmentAssignments, searchTerm, assignmentType]);

  const selectedMetric = useMemo(
    () =>
      metricDefinitions.find(
        (m) => String(m.id) === String(form.metricDefinitionId),
      ) || null,
    [metricDefinitions, form.metricDefinitionId],
  );
  const isBinaryMetric = !!selectedMetric?.allows_binary_completion;

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        weight_percent: Number(form.weight) || 0,
        target_value: isBinaryMetric ? null : Number(form.targetValue) || 0,
        unit_of_measure: form.unitOfMeasure,
        metric_definition_id: Number(form.metricDefinitionId) || null,
        contributes_to_score: form.contributesToScore,
        contributes_to_value: form.contributesToValue,
      };

      if (form.chosenParentKrId) {
        payload.chosen_parent_kr_id = form.chosenParentKrId;
      }

      if (assignmentType === "department") {
        payload.assign_department_ids = form.assignedIds;
        payload.objective_id = Number(objectiveId);
      } else if (assignmentType === "company") {
        // For company KRs, only assign departments if needed
        if (form.assignedIds.length > 0) {
          payload.assign_department_ids = form.assignedIds;
        }
      } else {
        payload.employee_objective_id = Number(objectiveId);
      }

      let route: string;
      if (assignmentType === "department") {
        route = editingKR 
          ? apiRoutes.okr.departmentKRById(editingKR.id) 
          : apiRoutes.okr.departmentKRs(objectiveId);
      } else if (assignmentType === "company") {
        route = editingKR 
          ? apiRoutes.okr.companyKRById(editingKR.id) 
          : apiRoutes.okr.companyKRs(objectiveId);
      } else {
        route = editingKR 
          ? apiRoutes.okr.employeeKRById(editingKR.id) 
          : apiRoutes.okr.employeeKRs(objectiveId);
      }

      const res = await makeCall({
        method: editingKR ? "PUT" : "POST",
        route,
        body: payload,
        isSecureRoute: true,
      });

      if (res.status === 200 || res.status === 201) {
        const savedKR = okrUnwrap(res) as any;
        
        // Sync contributors if employee assignment
        if (assignmentType === "employee") {
          const krId = savedKR?.id || editingKR?.id;
          if (krId) {
            await syncContributors(krId, form.assignedIds, editingKR);
          }
        }

        toast.success(editingKR ? "Key Result updated" : "Key Result created");
        onSuccess();
        onClose();
      } else {
        toast.error(okrErrorMessage(res));
      }
    } catch (err: any) {
      console.error("KR SAVE ERROR:", err?.response?.status, err?.response?.data || err?.message);
      const status = err?.response?.status;
      const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Unknown error";
      toast.error(`Error ${status}: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const syncContributors = async (krId: number, selectedIds: string[], originalKR: any) => {
    const existingIds = originalKR ? collectEmployeeIdsFromKr(originalKR) : [];
    const toAdd = selectedIds.filter(id => !existingIds.includes(id));
    const toRemove = originalKR?.contributors?.filter((c: any) => !selectedIds.includes(c.employee_id || c.employee?.id)) || [];

    console.log("Syncing contributors for KR:", krId, "Adding:", toAdd, "Removing:", toRemove.length);

    // Add new
    for (const empId of toAdd) {
      const empData = assignments.find(a => (a.employee?.id || a.id) === empId);
      const userId = empData?.user_id || empData?.employee?.user_id || empData?.user?.id;

      if (!userId) {
        console.warn("Missing user_id for employee:", empId, empData);
      }

      await makeCall({
        method: "POST",
        route: apiRoutes.okr.contributors,
        body: { 
          employee_id: empId, 
          employee_kr_id: krId,
          user_id: userId,
          role_type: "EMPLOYEE"
        },
        isSecureRoute: true,
      });
    }

    // Remove old
    for (const c of toRemove) {
      const cid = c.id;
      if (cid) {
        await makeCall({
          method: "DELETE",
          route: apiRoutes.okr.contributorById(cid),
          isSecureRoute: true,
        });
      }
    }
  };

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title={editingKR ? "Edit Key Result" : "New Key Result"}
      maxWidthClass="max-w-5xl"
      fullHeight={true}
      footer={
        <ApprovalFooter
          onCancel={onClose}
          onConfirm={handleSave}
          confirmText={submitting ? "Saving..." : editingKR ? "Save Changes" : "Create Key Result"}
          confirmDisabled={submitting || !form.title.trim()}
        />
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 h-full min-h-0">
        {/* LEFT: FORM */}
        <div className="lg:col-span-7 p-6 overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <MdTrackChanges className="text-lg" />
              <span>Core Details</span>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Title
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all"
                  placeholder="What is the measurable outcome?"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Description / Context
                </label>
                <BulletTextarea
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all min-h-[100px]"
                  placeholder="Additional details on how to achieve this..."
                  value={form.description}
                  onValueChange={(val) => setForm({ ...form, description: val })}
                />
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <MdOutlineHub className="text-lg" />
              <span>Measurement & Metric</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Metric Definition
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all"
                  value={form.metricDefinitionId}
                  onChange={(e) => {
                    const mId = e.target.value;
                    const mDef = metricDefinitions.find(d => String(d.id) === mId);
                    setForm({ 
                      ...form, 
                      metricDefinitionId: mId,
                      targetValue: mDef?.allows_binary_completion ? "" : form.targetValue,
                      unitOfMeasure: mDef?.unit_of_measure || form.unitOfMeasure
                    });
                  }}
                >
                  <option value="">Select a metric type...</option>
                  {metricDefinitions.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Unit of Measure
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all"
                  placeholder="e.g. %, ETB, Users"
                  value={form.unitOfMeasure}
                  onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}
                />
              </div>

              {!isBinaryMetric && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Target Value
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all"
                    placeholder="0.00"
                    value={form.targetValue}
                    onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Weight (%)
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-primary focus:ring-0 transition-all"
                  placeholder="0"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </div>
            </div>
            {isBinaryMetric && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-xs font-semibold text-blue-700">
                This metric uses binary completion. Target/current numeric values are not required.
              </div>
            )}
          </div>

          {/* Impact */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <MdSend className="text-lg" />
              <span>Impact & Strategy</span>
            </div>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.contributesToScore}
                  onChange={(e) => setForm((f) => ({ ...f, contributesToScore: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                />
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-gray-900">
                    Contribute to Objective Score
                  </span>
                  <p className="text-xs text-gray-500">
                    Whether this KR progress should affect the overall objective score.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.contributesToValue}
                  onChange={(e) => setForm((f) => ({ ...f, contributesToValue: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                />
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-gray-900">
                    Contribute to Objective Value
                  </span>
                  <p className="text-xs text-gray-500">
                    Whether this KR value should contribute to the numeric objective target.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT: ASSIGNMENT */}
        <div className="lg:col-span-5 border-l border-gray-100 bg-slate-50/30 flex flex-col h-full">
          <div className="p-6 flex-1 flex flex-col min-h-0">
             <div className="mb-6">
               <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-4">
                 {assignmentType === "employee" ? <MdGroups className="text-lg" /> : <MdBusiness className="text-lg" />}
                 <span>Assign Owner {assignmentType === "employee" ? "Employees" : "Departments"}</span>
               </div>
              <div className="relative">
                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Search ${assignmentType}s...`}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:ring-primary/20 shadow-sm transition-all"
                />
              </div>
            </div>

              <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2">
                {((assignmentType === "employee" && loading) || ((assignmentType === "department" || assignmentType === "company") && depsLoading)) ? (
                  <div className="py-12 text-center text-gray-400">Loading...</div>
                ) : filteredAssignments.length === 0 ? (
                 <div className="py-12 text-center">
                   <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400 mb-3">
                     <MdGroups className="text-2xl" />
                   </div>
                   <p className="text-sm text-gray-500 font-medium">No matching {assignmentType}s found.</p>
                 </div>
               ) : (
                 filteredAssignments.map((item) => {
                  const itemId = assignmentType === "employee" ? item.employee?.id || item.id : item.id;
                  const checked = form.assignedIds.includes(itemId);
                  return (
                    <label
                      key={itemId}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 text-sm transition-all border ${
                        checked
                          ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10"
                          : "bg-white border-slate-100 hover:bg-white hover:border-gray-200 hover:shadow-sm"
                      }`}
                    >
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setForm((f) => ({
                              ...f,
                              assignedIds: e.target.checked
                                ? [...f.assignedIds, itemId]
                                : f.assignedIds.filter((id) => id !== itemId),
                            }));
                          }}
                          className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary/20 accent-primary"
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`font-semibold truncate ${checked ? "text-primary" : "text-gray-900"}`}>
                          {assignmentType === "employee" ? item.employee?.full_name || "Unknown Employee" : item.name}
                        </span>
                        <span className="text-[11px] text-gray-500 truncate uppercase tracking-tight font-bold">
                          {assignmentType === "employee" 
                            ? `${item.jobTitle?.title || "No Title"} • ${item.department?.name || "No Dept"}`
                            : item.department_code || "No Code"}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {form.assignedIds.length > 0 && (
              <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-xl">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  {form.assignedIds.length} Selected Owner{form.assignedIds.length > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalLayout>
  );
}

function collectEmployeeIdsFromKr(kr: any): string[] {
  if (!kr) return [];
  const fromContributors = (kr.contributors || []).map((c: any) =>
    typeof c === "string" ? c : c.employee_id || c.employee?.id,
  );
  const ownerId = kr.employee_id || kr.employee?.id;
  const ids = ownerId ? [ownerId, ...fromContributors] : fromContributors;
  return Array.from(new Set(ids.filter(Boolean))) as string[];
}
