import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import ModalLayout from "./ModalLayout";
import ApprovalFooter from "./ApprovalFooter";
import BulletTextarea from "../../../../components/common/BulletTextarea";
import { MdSearch, MdGroups, MdBusiness } from "react-icons/md";
import Toggle from "../../../../components/Core/ui/Toggle";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import toast from "react-hot-toast";
import { okrErrorMessage, okrUnwrap } from "../../../../utils/okrApi";
import { selectDepartments, selectDepartmentsLoading } from "../../Departments/slice/selectors";
import { selectAuthUser } from "../../../../slice/authSlice/selectors";
import { selectIsManager } from "../../../../slice/managerSlice/selectors";
import { getRoleNameById } from "../../../../../utils/constants";

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
  value_based_progress?: boolean;
  is_financial?: boolean;
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
    assignToSelfOnly: false,
    assigneeDetails: {} as Record<string | number, { target: string; weight: string }>,
    contributesToScore: true,
    contributesToValue: true,
    chosenParentKrId: null as number | null,
  });

  const reduxDepartments = useSelector(selectDepartments) as any[];
  const depsLoading = useSelector(selectDepartmentsLoading);
  const authUser = useSelector(selectAuthUser) as any;
  const isManager = useSelector(selectIsManager);

  const roleName = authUser?.role?.name || authUser?.role_name || authUser?.roleName || getRoleNameById(authUser?.role_id);
  const canAssignOthers = isManager || ["Admin", "HR", "CEO", "Dept Head", "Super Admin", "SuperAdmin"].includes(roleName);

  // Reset form when modal opens/changes
  useEffect(() => {
    if (isOpen) {
      if (editingKR) {
        const details: Record<string | number, { target: string; weight: string }> = {};

        if (assignmentType === "employee") {
          // contributors now include required_target, weight_percent, user.employee.id
          (editingKR.contributors || []).forEach((c: any) => {
            const empId = c.employee_id ?? c.user?.employee?.id ?? c.employee?.id;
            if (empId) {
              details[empId] = {
                target: String(c.required_target ?? ""),
                weight: String(c.weight_percent ?? ""),
              };
            }
          });
        } else {
          // companyKrDepartments includes required_target, weight_percent, department_id
          (editingKR.departments || []).forEach((d: any) => {
            const depId = d.department_id ?? d.department?.id;
            if (depId) {
              details[depId] = {
                target: String(d.required_target ?? ""),
                weight: String(d.weight_percent ?? ""),
              };
            }
          });
        }

        const assignedIds = assignmentType === "employee"
          ? collectEmployeeIdsFromKr(editingKR)
          : (editingKR.departments || [])
              .map((d: any) => d.department_id ?? d.department?.id)
              .filter(Boolean);

        setForm({
          title: editingKR.title || "",
          description: editingKR.description || "",
          weight: String(editingKR.weight_percent ?? editingKR.weight ?? ""),
          targetValue: String(editingKR.target_value ?? editingKR.targetValue ?? ""),
          unitOfMeasure: editingKR.unit_of_measure ?? editingKR.unitOfMeasure ?? "",
          metricDefinitionId: String(editingKR.metric_definition_id ?? editingKR.metricDefinitionId ?? ""),
          assignedIds,
          assignToSelfOnly: false,
          assigneeDetails: details,
          contributesToScore: (editingKR.contributes_to_score ?? editingKR.contributesToScore ?? editingKR.contributes_to_objective_score) !== false,
          contributesToValue: (editingKR.contributes_to_value ?? editingKR.contributesToValue ?? editingKR.contributes_to_objective_value) !== false,
          chosenParentKrId: editingKR.chosen_parent_kr_id ?? editingKR.chosenParentKrId ?? null,
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
          assignToSelfOnly: false,
          assigneeDetails: {},
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

    let finalUsers: any[] = [];
    let finalDepartments: any[] = [];
    
    if (assignmentType === "employee") {
      const selfId = authUser?.employee_id ? String(authUser.employee_id) : null;
      let targetIds = form.assignedIds;
      if ((form.assignToSelfOnly || !canAssignOthers) && selfId) {
        targetIds = [selfId];
      }

      if (targetIds.length > 1 && !isBinaryMetric) {
        const totalContribution = targetIds.reduce((sum, id) => sum + (Number(form.assigneeDetails[id]?.target) || 0), 0);
        if (totalContribution > 0 && totalContribution < Number(form.targetValue)) {
          toast.error("Total contributions must meet or exceed the Key Result target.");
          return;
        }
      }
      finalUsers = targetIds.map(id => ({
        employeeId: id,
        requiredTarget: isBinaryMetric ? null : Number(form.assigneeDetails[id]?.target) || 0,
        weightPercent: Number(form.assigneeDetails[id]?.weight) || 0
      }));
    } else {
      if (form.assignedIds.length > 1 && !isBinaryMetric) {
        const totalContribution = form.assignedIds.reduce((sum, id) => sum + (Number(form.assigneeDetails[id]?.target) || 0), 0);
        if (totalContribution > 0 && totalContribution < Number(form.targetValue)) {
          toast.error("Total contributions must meet or exceed the Key Result target.");
          return;
        }
      }
      finalDepartments = form.assignedIds.map(id => ({
        departmentId: id,
        requiredTarget: isBinaryMetric ? null : Number(form.assigneeDetails[id]?.target) || 0,
        weightPercent: Number(form.assigneeDetails[id]?.weight) || 0
      }));
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
        payload.assign_departments = finalDepartments;
        payload.objective_id = Number(objectiveId);
      } else if (assignmentType === "company") {
        // For company KRs, only assign departments if needed
        if (finalDepartments.length > 0) {
          payload.assign_departments = finalDepartments;
        }
      } else {
        payload.employee_objective_id = Number(objectiveId);
        payload.assign_users = finalUsers;
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
            const selfId = authUser?.employee_id ? String(authUser.employee_id) : null;
            const finalIds = (form.assignToSelfOnly || !canAssignOthers) && selfId
              ? [selfId]
              : finalUsers.map(u => String(u.employeeId));
            await syncContributors(krId, finalIds, editingKR);
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
      const rawMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || "";
      // Translate technical backend messages into user-friendly ones
      const message = rawMessage.includes("company_kr_id or department_kr_id")
        ? "Could not link the owner to this Key Result. Please re-select the assignee and try again."
        : rawMessage.includes("role_type must be one of")
        ? "Invalid assignee role. Please contact your system administrator."
        : rawMessage.includes("already a contributor")
        ? "One or more selected employees are already assigned to this Key Result."
        : rawMessage || "Something went wrong. Please try again.";
      toast.error(`${status ? `Error ${status}: ` : ""}${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const syncContributors = async (krId: number, selectedIds: string[], originalKR: any) => {
    const existingIds = originalKR ? collectEmployeeIdsFromKr(originalKR) : [];
    const toAdd = selectedIds.filter(id => !existingIds.includes(id));
    const toRemove = originalKR?.contributors?.filter((c: any) => !selectedIds.includes(String(c.employee_id || c.employee?.id))) || [];

    console.log("Syncing contributors for KR:", krId, "Adding:", toAdd, "Removing:", toRemove.length);

    // Add new
    for (const empId of toAdd) {
      // Check if this is the self-assignment (current user)
      const isSelf = String(authUser?.employee_id) === String(empId);

      let userId: string | null = null;
      if (isSelf) {
        userId = authUser?.id ? String(authUser.id) : authUser?.user_id ? String(authUser.user_id) : null;
      } else {
        const empData = assignments.find(a => String(a.employee?.id || a.id) === String(empId));
        userId = String(empData?.user_id || empData?.employee?.user_id || empData?.user?.id || "") || null;
      }

      if (!userId) {
        console.warn("Missing user_id for employee:", empId, "— skipping contributor assignment");
        continue;
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
              {/* <MdTrackChanges className="text-lg" /> */}
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
              {/* <MdOutlineHub className="text-lg" /> */}
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
              {/* <MdSend className="text-lg" /> */}
              <span>Impact & Strategy</span>
            </div>
            <div className="space-y-3">
              {!selectedMetric?.value_based_progress && (
                <Toggle
                  label="Contribute to Objective Score"
                  description="Whether this Key Result progress should affect the overall objective score."
                  checked={form.contributesToScore}
                  onChange={(val: boolean) => setForm((f) => ({ ...f, contributesToScore: val }))}
                />
              )}
              {!selectedMetric?.is_financial && (
                <Toggle
                  label="Contribute to Objective Value"
                  description="Whether this Key Result value should contribute to the numeric objective target."
                  checked={form.contributesToValue}
                  onChange={(val: boolean) => setForm((f) => ({ ...f, contributesToValue: val }))}
                />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: ASSIGNMENT */}
        <div className="lg:col-span-5 border-l border-gray-100 bg-slate-50/30 flex flex-col h-full">
          <div className="p-6 flex-1 flex flex-col min-h-0">
            <div className="mb-6">
              {/* Summary badges at the top */}
              {(form.assignedIds.length > 0 || (form.assignedIds.length > 1 && !isBinaryMetric && form.targetValue)) && (
                <div className="flex flex-col gap-1.5 mb-4 p-3 rounded-xl bg-slate-100/50 border border-slate-200">
                  {form.assignedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Total Owners</span>
                      <span className="text-xs font-bold text-primary bg-primary/10 rounded-lg px-2 py-0.5 ml-auto">
                        {form.assignedIds.length} Owner{form.assignedIds.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                  {form.assignedIds.length > 1 && !isBinaryMetric && form.targetValue && (() => {
                    const total = form.assignedIds.reduce((s, id) => s + (Number(form.assigneeDetails[id]?.target) || 0), 0);
                    const isOk = total >= Number(form.targetValue);
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Total Contribution</span>
                        <span className={`text-xs font-bold rounded-lg px-2 py-0.5 ml-auto border ${
                          isOk
                            ? "text-green-700 bg-green-100 border-green-200"
                            : "text-red-600 bg-red-100 border-red-200"
                        }`}>
                          {total.toLocaleString()} / {Number(form.targetValue).toLocaleString()}{form.unitOfMeasure ? ` ${form.unitOfMeasure}` : ""}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {canAssignOthers && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    {assignmentType === "employee" ? <MdGroups className="text-lg" /> : <MdBusiness className="text-lg" />}
                    <span>Assign Owner {assignmentType === "employee" ? "Employees" : "Departments"}</span>
                  </div>
                </div>
              )}

              {/* Assign to Self Only toggle – hides the list entirely */}
              {canAssignOthers && (
                <label className="flex items-center gap-3 mb-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.assignToSelfOnly}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        assignToSelfOnly: e.target.checked,
                        assignedIds: e.target.checked ? [] : f.assignedIds,
                      }))
                    }
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary/20 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Assign to Self Only</p>
                    <p className="text-[11px] text-gray-400">Auto-assign this KR to yourself only, skip the list below.</p>
                  </div>
                </label>
              )}

              {canAssignOthers && !form.assignToSelfOnly && (
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
              )}
            </div>

            {form.assignToSelfOnly || !canAssignOthers ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <MdGroups className="text-2xl text-primary" />
                </div>
                <p className="text-sm font-semibold text-primary">Assigned to You</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {authUser?.employee?.full_name || authUser?.name || "Current User"}
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2">
                  {/* Assign Self row – shown at top so you can add yourself alongside others */}
                  {assignmentType === "employee" && authUser?.employee_id && (() => {
                    const selfId = String(authUser.employee_id);
                    const selfChecked = form.assignedIds.includes(selfId);
                    const selfDetail = form.assigneeDetails[selfId] || { target: "", weight: "" };
                    const selfName = authUser?.employee?.full_name || authUser?.name || "Myself";
                    return (
                      <div key="__self__" className="space-y-2">
                        <label className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 text-sm transition-all border ${selfChecked ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10" : "bg-white border-dashed border-primary/30 hover:bg-primary/5"}`}>
                          <input
                            type="checkbox"
                            checked={selfChecked}
                            onChange={(e) => {
                              setForm((f) => ({
                                ...f,
                                assignedIds: e.target.checked
                                  ? [...f.assignedIds.filter(id => id !== selfId), selfId]
                                  : f.assignedIds.filter((id) => id !== selfId),
                              }));
                            }}
                            className="h-5 w-5 rounded border-gray-300 text-primary accent-primary"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className={`font-semibold truncate ${selfChecked ? "text-primary" : "text-gray-700"}`}>{selfName}</span>
                            <span className="text-[10px] text-primary/60 font-medium uppercase tracking-wider">Assign Self</span>
                          </div>
                        </label>
                        {/* Contribution inputs for self – only when >1 total selected */}
                        {selfChecked && form.assignedIds.length > 1 && !isBinaryMetric && (
                          <div className="ml-8 grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                                My Target{form.unitOfMeasure ? ` (${form.unitOfMeasure})` : ""}
                              </label>
                              <input
                                type="number" placeholder="0" value={selfDetail.target}
                                onChange={(e) => setForm((f) => ({ ...f, assigneeDetails: { ...f.assigneeDetails, [selfId]: { ...selfDetail, target: e.target.value } } }))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-primary focus:ring-0 transition-all"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">My Weight (%)</label>
                              <input
                                type="number" placeholder="0" value={selfDetail.weight}
                                onChange={(e) => setForm((f) => ({ ...f, assigneeDetails: { ...f.assigneeDetails, [selfId]: { ...selfDetail, weight: e.target.value } } }))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-primary focus:ring-0 transition-all"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Regular assignee list */}
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
                    filteredAssignments
                      .filter(item => {
                        const itemId = assignmentType === "employee" ? String(item.employee?.id || item.id) : item.id;
                        return String(itemId) !== String(authUser?.employee_id);
                      })
                      .map((item) => {
                        const itemId = String(assignmentType === "employee" ? item.employee?.id || item.id : item.id);
                        const checked = form.assignedIds.includes(itemId);
                        const itemLabel = assignmentType === "employee" ? item.employee?.full_name || "Unknown Employee" : item.name;
                        const detail = form.assigneeDetails[itemId] || { target: "", weight: "" };
                        return (
                          <div key={itemId} className="space-y-2">
                            <label className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 text-sm transition-all border ${checked ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10" : "bg-white border-slate-100 hover:bg-white hover:border-gray-200 hover:shadow-sm"}`}>
                              <input
                                type="checkbox" checked={checked}
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
                              <div className="flex flex-col min-w-0">
                                <span className={`font-semibold truncate ${checked ? "text-primary" : "text-gray-900"}`}>{itemLabel}</span>
                              </div>
                            </label>

                            {/* Contribution inputs – only when >1 total selected and metric is not binary */}
                            {checked && form.assignedIds.length > 1 && !isBinaryMetric && (
                              <div className="ml-8 grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                                    Target{form.unitOfMeasure ? ` (${form.unitOfMeasure})` : ""}
                                  </label>
                                  <input
                                    type="number" placeholder="0" value={detail.target}
                                    onChange={(e) => setForm((f) => ({ ...f, assigneeDetails: { ...f.assigneeDetails, [itemId]: { ...detail, target: e.target.value } } }))}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-primary focus:ring-0 transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Weight (%)</label>
                                  <input
                                    type="number" placeholder="0" value={detail.weight}
                                    onChange={(e) => setForm((f) => ({ ...f, assigneeDetails: { ...f.assigneeDetails, [itemId]: { ...detail, weight: e.target.value } } }))}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-primary focus:ring-0 transition-all"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Validation warning inline below list when total is short */}
                {form.assignedIds.length > 1 && !isBinaryMetric && form.targetValue && (
                  form.assignedIds.reduce((s, id) => s + (Number(form.assigneeDetails[id]?.target) || 0), 0) < Number(form.targetValue) && (
                    <p className="mt-2 text-[10px] text-red-500 text-center">
                      Total contributions must meet or exceed the Key Result target.
                    </p>
                  )
                )}
              </>
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
    c.employee_id ?? c.user?.employee?.id ?? c.employee?.id,
  );
  return Array.from(new Set(fromContributors.filter(Boolean))).map(String);
}
