import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import Button from "../../../../components/Core/ui/Button";
import Card from "../../../../components/Core/ui/Card";
import FormField from "../../../../components/common/FormField";
import FormAutocomplete from "../../../../components/Core/ui/FormAutocomplete";
import {
  FiArrowLeft,
  FiTrendingUp,
  FiBriefcase,
  FiDollarSign,
  FiCalendar,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiUser,
  FiLayers,
} from "react-icons/fi";
import { usePromotionSlice } from "./slice";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import {
  selectPromotionEmployee,
  selectPromotionLoading,
  selectPromotionError,
  selectPromotionSuccess,
} from "./slice/selectors";
import LoadingSkeleton from "../../../../components/common/LoadingSkeleton";
import { getFileUrl } from "../../../../utils/fileUtils";
import toast from "react-hot-toast";
import DynamicAutocomplete from "../../../../components/Core/ui/FormAutocomplete";
import adminService, { AllowanceType } from "../../../../services/adminService";

export default function PromotionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { actions } = usePromotionSlice();

  const employee = useSelector(selectPromotionEmployee);
  const loading = useSelector(selectPromotionLoading);
  const error = useSelector(selectPromotionError);
  const success = useSelector(selectPromotionSuccess);

  const [formData, setFormData] = useState<any>({
    new_job_title_id: "",
    new_job_title_name: "",
    new_job_level_name: "",
    new_department_id: "",
    new_department_name: "",
    new_manager_id: "",
    new_manager_name: "",
    new_employment_type: "",
    new_gross_salary: "",
    new_basic_salary: "",
    new_allowances: [],
    event_type: "PROMOTION",
    effective_date: new Date().toISOString().substring(0, 10),
    justification: "",
    notes: "",
  });

  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [createModalState, setCreateModalState] = useState<{
    isOpen: boolean;
    type: "allowance" | null;
    initialValue: string;
    targetIndex?: number;
  }>({
    isOpen: false,
    type: null,
    initialValue: "",
  });

  const [jobTitlesList, setJobTitlesList] = useState<any[]>([]);

  const [activeEmployment, setActiveEmployment] = useState<any>(null);

  const [clientError, setClientError] = useState<string | null>(null);
  const [entitiesLoadError, setEntitiesLoadError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (id) {
      dispatch(actions.fetchEmployeeRequest(id));
    }
  }, [id, dispatch, actions]);

  useEffect(() => {
    if (employee) {
      const active =
        employee.employments?.find((e: any) => e.is_active) ||
        employee.employments?.[0];
      setActiveEmployment(active);

      // Initialize form with current data
      if (active) {
        setFormData((prev: any) => ({
          ...prev,
          new_gross_salary: active.gross_salary?.toString() || "",
          new_basic_salary: active.basic_salary?.toString() || "",
          new_allowances:
            active.allowances?.map((a: any) => ({
              name: a.allowanceType?.name || "",
              amount: a.amount?.toString() || "",
            })) || [],
          new_job_title_id: active.job_title_id?.toString() || "",
          new_job_title_name: active.jobTitle?.title || "",
          new_job_level_name: active.jobTitle?.level || "",
          new_department_id: active.department_id?.toString() || "",
          new_department_name: active.department?.name || "",
          new_manager_id: active.manager_id || "",
          new_manager_name: active.manager?.full_name || "",
          new_employment_type: active.employment_type || "Full Time",
        }));
      }
    }
  }, [employee]);

  // Success handling
  useEffect(() => {
    if (success) {
      // Small timeout to show success state? Or just navigate.
      setTimeout(() => {
        navigate(`/admin/employees/${id}`);
        dispatch(actions.resetPromotion());
      }, 1500);
    }
  }, [success, navigate, id, dispatch, actions]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleAllowanceChange = (index: number, field: string, value: any) => {
    const updated = [...formData.new_allowances];
    updated[index] = { ...updated[index], [field]: value };
    handleChange("new_allowances", updated);
  };

  const addAllowance = () => {
    handleChange("new_allowances", [
      ...formData.new_allowances,
      { name: "", amount: "" },
    ]);
  };

  const removeAllowance = (index: number) => {
    handleChange(
      "new_allowances",
      formData.new_allowances.filter((_: any, i: number) => i !== index)
    );
  };

  const resolveAllowanceTypeId = (name: string): number | null => {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const match = allowanceTypes.find(
      (a) => a.name?.toLowerCase() === trimmed.toLowerCase()
    );
    return match ? match.id : null;
  };

  const filterAllowanceTypes = async (query: string) => {
    return allowanceTypes
      .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
      .map((a) => a.name);
  };

  const handleOpenCreateModal = (value: string, index: number) => {
    setCreateModalState({
      isOpen: true,
      type: "allowance",
      initialValue: value,
      targetIndex: index,
    });
  };

  // ✅ Auto-calculate Gross Salary
  useEffect(() => {
    const basic = parseFloat(formData.new_basic_salary) || 0;
    const totalAllowances = (formData.new_allowances || []).reduce(
      (sum: number, allowance: any) => {
        return sum + (parseFloat(allowance.amount) || 0);
      },
      0
    );
    const gross = basic + totalAllowances;
    const formattedGross = gross > 0 ? gross.toFixed(2) : "";

    if (formData.new_gross_salary !== formattedGross) {
      handleChange("new_gross_salary", formattedGross);
    }
  }, [formData.new_basic_salary, formData.new_allowances]);

  // Entity Maps for ID lookup
  const [deptMap, setDeptMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchEntities = async () => {
      try {
        setEntitiesLoadError(null);
        const [deptRes, jobRes, allowTypes] = await Promise.all([
          makeCall({
            route: apiRoutes.departments,
            method: "GET",
            isSecureRoute: true,
          }),
          makeCall({
            route: apiRoutes.jobTitles,
            method: "GET",
            isSecureRoute: true,
          }),
          adminService.getAllowanceTypes(),
        ]);

        if (allowTypes) {
          setAllowanceTypes(allowTypes);
        }

        const departments =
          deptRes?.data?.data?.departments ||
          deptRes?.data?.data?.department ||
          deptRes?.data?.data;

        if (Array.isArray(departments)) {
          const map: Record<string, number> = {};
          departments.forEach((d: any) => {
            if (d?.name && d?.id != null) map[d.name] = d.id;
          });
          setDeptMap(map);
        }

        const jobTitles =
          jobRes?.data?.data?.jobTitles ||
          jobRes?.data?.data?.job_titles ||
          jobRes?.data?.data;

        if (Array.isArray(jobTitles)) {
          setJobTitlesList(jobTitles);
        }
      } catch (e) {
        console.error("Failed to fetch entity maps", e);
        setEntitiesLoadError(
          "Failed to load departments/job titles. Please refresh and try again."
        );
        toast.error(
          "Failed to load departments/job titles. Please refresh and try again."
        );
      }
    };
    fetchEntities();
  }, []);

  // Sync Job Title ID when title or level changes
  useEffect(() => {
    if (formData.new_job_title_name && jobTitlesList.length > 0) {
      const match = jobTitlesList.find(
        (j) =>
          j.title === formData.new_job_title_name &&
          (formData.new_job_level_name
            ? j.level === formData.new_job_level_name
            : true)
      );
      if (match && match.id.toString() !== formData.new_job_title_id) {
        setFormData((prev: any) => ({
          ...prev,
          new_job_title_id: match.id.toString(),
        }));
      }
    }
  }, [formData.new_job_title_name, formData.new_job_level_name, jobTitlesList]);

  const handleAutocompleteChange = (
    type: "title" | "dept" | "level",
    name: string
  ) => {
    setClientError(null);
    if (type === "title") {
      setFormData((prev: any) => ({
        ...prev,
        new_job_title_name: name,
        new_job_title_id: "",
      }));
    } else if (type === "level") {
      setFormData((prev: any) => ({
        ...prev,
        new_job_level_name: name,
        new_job_title_id: "",
      }));
    } else {
      const id = deptMap[name];
      setFormData((prev: any) => ({
        ...prev,
        new_department_name: name,
        new_department_id: id || "",
      }));
    }
  };

  const resolveDepartmentId = (): string | null => {
    if (formData.new_department_id) return String(formData.new_department_id);
    const mapped = deptMap[formData.new_department_name];
    return mapped != null ? String(mapped) : null;
  };

  const resolveJobTitleId = (): string | null => {
    if (formData.new_job_title_id) return String(formData.new_job_title_id);
    if (!formData.new_job_title_name) return null;

    // Strict match: Title must match AND Level must match (treating null/undefined as empty string)
    const strictMatch = jobTitlesList.find(
      (j: any) =>
        j?.title === formData.new_job_title_name &&
        (j?.level || "") === (formData.new_job_level_name || "")
    );

    return strictMatch?.id != null ? String(strictMatch.id) : null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    if (!employee) {
      toast.error(
        "Employee record is not loaded yet. Please refresh and try again."
      );
      return;
    }

    if (!activeEmployment) {
      toast.error(
        "This employee has no active employment record. Please add/activate an employment record, then try again."
      );
      return;
    }

    const missing: string[] = [];

    if (!formData.event_type) missing.push("Event Type");
    if (!formData.effective_date) missing.push("Effective Date");
    if (!formData.new_employment_type) missing.push("New Employment Type");
    if (!formData.new_job_title_name) missing.push("New Job Title");
    if (!formData.new_job_level_name) missing.push("New Job Level");
    if (!formData.new_department_name) missing.push("New Department");
    if (!formData.justification) missing.push("Justification");

    // Relaxed validation: ID is optional if name is provided (backend handles creation)
    const finalDeptId = resolveDepartmentId();
    // if (!finalDeptId && !formData.new_department_name) missing.push("New Department");

    const finalJobId = resolveJobTitleId();
    // if (!finalJobId && !formData.new_job_title_name) missing.push("New Job Title");

    if (missing.length > 0) {
      const prefix = entitiesLoadError ? `${entitiesLoadError} ` : "";
      toast.error(`${prefix}Missing: ${missing.join(", ")}.`);
      return;
    }

    const allowancesPayload = (formData.new_allowances || [])
      .filter((a: any) => a.name && a.amount)
      .map((a: any) => {
        const typeId = resolveAllowanceTypeId(a.name);
        // if (!typeId) {
        //   ToastService.error(
        //     `Allowance Type "${a.name}" not found. Please create it first.`
        //   );
        //   return null;
        // }
        return {
          allowance_type_id: typeId,
          name: a.name,
          amount: Number(a.amount),
          currency: "ETB",
        };
      })
      .filter(Boolean);

    // If any allowance was invalid, stop
    if (
      (formData.new_allowances?.length || 0) > 0 &&
      allowancesPayload.length !== (formData.new_allowances?.filter((a: any) => a.name && a.amount)?.length || 0)
    ) {
      return;
    }

    const payload = {
      employee_id: employee.id,
      current_employment_id: String(activeEmployment.id),
      new_job_title_id: finalJobId ? String(finalJobId) : null,
      new_job_title_name: formData.new_job_title_name,
      new_job_level_name: formData.new_job_level_name,
      new_department_id: finalDeptId ? String(finalDeptId) : null,
      new_manager_id: formData.new_manager_id || null,
      new_employment_type: formData.new_employment_type,
      new_gross_salary: formData.new_gross_salary,
      new_basic_salary: formData.new_basic_salary || "0",
      new_allowances: allowancesPayload,
      event_type: formData.event_type,
      effective_date: formData.effective_date,
      justification: formData.justification,
      notes: formData.notes,
      documentFile: formData.documentFile,
    };

    dispatch(actions.promoteRequest(payload));
  };

  if (loading && !employee) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <LoadingSkeleton variant="rectangular" width="100%" height={400} />
        </div>
      </AdminLayout>
    );
  }

  if (!employee) return null;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/admin/employees/${id}`)}
            className="flex items-center text-gray-500 hover:text-gray-800 transition-colors"
          >
            <FiArrowLeft className="mr-2" /> Back to Employee
          </button>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <FiTrendingUp /> <span>Career Management</span>
          </div>
        </div>

        {/* Employee Brief Card */}
        <Card
          title="Employee Information"
          className="bg-primary-light border-primary-light"
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-primary text-2xl font-bold shadow-sm border border-primary-light overflow-hidden">
              {employee.profilePicture ? (
                <img
                  src={getFileUrl(employee.profilePicture)}
                  alt={employee.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                employee.full_name?.charAt(0)
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {employee.full_name}
              </h1>
              <p className="text-gray-500 text-sm">
                Current:{" "}
                <span className="font-semibold text-gray-700">
                  {employee.job_title}
                </span>{" "}
                • {employee.department}
              </p>
            </div>
          </div>
        </Card>

        {/* Multi-step Style Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card
            title="Career Event Details"
            icon={<FiTrendingUp className="text-primary" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                type="select"
                label="Event Type"
                name="event_type"
                value={formData.event_type}
                onChange={(e) => handleChange("event_type", e.target.value)}
                options={[
                  { value: "PROMOTION", label: "Promotion" },
                  { value: "DEMOTION", label: "Demotion" },
                  { value: "TRANSFER", label: "Transfer" },
                ]}
                required
              />
              <FormField
                label="Effective Date"
                name="effective_date"
                type="date"
                value={formData.effective_date}
                onChange={(e) => handleChange("effective_date", e.target.value)}
                icon={FiCalendar}
                required
              />
            </div>
          </Card>

          <Card
            title="New Position & Department"
            icon={<FiBriefcase className="text-primary" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormAutocomplete
                label="New Job Title"
                value={formData.new_job_title_name}
                onChange={(val) => handleAutocompleteChange("title", val)}
                onCreateNew={(val) => handleAutocompleteChange("title", val)}
                onIdChange={(jobTitleId) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    new_job_title_id: jobTitleId ? String(jobTitleId) : "",
                  }))
                }
                placeholder="Select or create new title"
                type="jobTitles"
                required
                icon={<FiBriefcase />}
              />
              <FormAutocomplete
                label="New Job Level"
                value={formData.new_job_level_name}
                onChange={(val) => handleAutocompleteChange("level", val)}
                onCreateNew={(val) => handleAutocompleteChange("level", val)}
                placeholder="Select or create new level"
                type="jobLevels"
                required
                icon={<FiLayers />}
              />
              <FormAutocomplete
                label="New Department"
                value={formData.new_department_name}
                onChange={(val) => handleAutocompleteChange("dept", val)}
                onCreateNew={(val) => handleAutocompleteChange("dept", val)}
                onIdChange={(deptId) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    new_department_id: deptId ? String(deptId) : "",
                  }))
                }
                placeholder="Select or create new department"
                type="departments"
                required
              />
              <FormField
                type="select"
                label="New Employment Type"
                name="new_employment_type"
                value={formData.new_employment_type}
                onChange={(e) =>
                  handleChange("new_employment_type", e.target.value)
                }
                options={[
                  { value: "Full Time", label: "Full Time" },
                  { value: "Part-Time", label: "Part-Time" },
                  { value: "Contract", label: "Contract" },
                  { value: "Outsourced", label: "Outsourced" },
                ]}
                required
              />
              <FormAutocomplete
                label="Manager (Optional)"
                value={formData.new_manager_name}
                onIdChange={(id) =>
                  setFormData((prev: any) => ({ ...prev, new_manager_id: id }))
                }
                onChange={(val) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    new_manager_name: val,
                  }))
                }
                type="managers"
                placeholder="Search and select manager"
                icon={<FiUser />}
              />
            </div>
          </Card>

          <Card
            title="Salary & Compensation"
            icon={<FiDollarSign className="text-primary" />}
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="w-full">
                  <label className="block mb-1.5 font-semibold text-gray-700">
                    Calculated Gross Salary
                  </label>
                  <div className="flex items-center justify-center bg-primary-light border border-primary-light rounded-xl px-4 py-3 h-12.5 shadow-sm">
                    <span className="text-xl font-bold text-primary">
                      {formData.new_gross_salary || "0.00"}
                    </span>
                  </div>
                </div>
                <FormField
                  label="Basic Salary"
                  name="new_basic_salary"
                  type="text"
                  inputMode="decimal"
                  value={formData.new_basic_salary}
                  onChange={(e) =>
                    handleChange("new_basic_salary", e.target.value)
                  }
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <FiPlus /> New Allowances
                  </h3>
                  <button
                    type="button"
                    onClick={addAllowance}
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    + Add Row
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.new_allowances.map((al: any, idx: number) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <div className="flex-1">
                        <DynamicAutocomplete
                          label={idx === 0 ? "Allowance Name" : ""}
                          type="allowanceTypes"
                          value={al.name}
                          onChange={(val) =>
                            handleAllowanceChange(idx, "name", val)
                          }
                          fetchSuggestionsFn={filterAllowanceTypes}
                          onCreateNew={(val) => handleOpenCreateModal(val, idx)}
                          placeholder="e.g. Housing"
                          containerClassName="w-full"
                        />
                      </div>
                      <div className="w-32">
                        <FormField
                          label={idx === 0 ? "Amount" : ""}
                          name={`allowance_amount_${idx}`}
                          value={al.amount}
                          onChange={(e) =>
                            handleAllowanceChange(idx, "amount", e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAllowance(idx)}
                        className={`mb-1.5 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ${idx === 0 ? "mt-7" : ""
                          }`}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ))}
                  {formData.new_allowances.length === 0 && (
                    <p className="text-sm text-gray-400 italic">
                      No allowances added.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Justification & Documentation"
            icon={<FiFileText className="text-primary" />}
          >
            <div className="space-y-4">
              <div className="w-full">
                <label className="block mb-1.5 font-semibold text-gray-700">
                  Justification
                </label>
                <textarea
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 min-h-25 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-gray-800"
                  placeholder="Reason for this career event..."
                  value={formData.justification}
                  onChange={(e) =>
                    handleChange("justification", e.target.value)
                  }
                  required
                />
              </div>
              <div className="w-full">
                <label className="block mb-1.5 font-semibold text-gray-700">
                  {formData.event_type === "PROMOTION"
                    ? "Promotion Letter"
                    : formData.event_type === "DEMOTION"
                      ? "Demotion Letter"
                      : "Transfer Letter"}{" "}
                  (Optional)
                </label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 shadow-sm">
                    <FiFileText className="text-k-orange" />
                    <span>Choose File</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleChange("documentFile", file);
                        }
                      }}
                    />
                  </label>
                  {formData.documentFile ? (
                    <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-md text-green-700 text-sm">
                      <span className="truncate max-w-[200px]">
                        {formData.documentFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleChange("documentFile", null)}
                        className="p-1 hover:bg-green-100 rounded-full cursor-pointer"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">
                      No document selected
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="w-full mt-4">
              <label className="block mb-1.5 font-semibold text-gray-700">
                Additional Notes
              </label>
              <textarea
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 min-h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-gray-800"
                placeholder="Any other details..."
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
              />
            </div>

          </Card>

          {/* Feedback & Actions */}
          {entitiesLoadError && !error && (
            <div className="p-4 bg-amber-50 text-amber-800 rounded-xl border border-amber-100 flex items-center gap-3">
              <span className="font-bold">Notice:</span> {entitiesLoadError}
            </div>
          )}

          {clientError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-3">
              <span className="font-bold">Fix required:</span> {clientError}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-3">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-100 flex items-center gap-3 animate-pulse">
              <span className="font-bold">Success!</span> Career event recorded
              successfully. Redirecting...
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <Button
              variant="subtle"
              onClick={() => navigate(`/admin/employees/${id}`)}
              type="button"
              className="px-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={success || loading}
              className="px-12 bg-primary text-white"
            >
              Confirm Event
            </Button>
          </div>
        </form>
      </div>

      {/* Dynamic Creation Modal */}
      {/* <CreateItemModal
        isOpen={createModalState.isOpen}
        onClose={() =>
          setCreateModalState((prev) => ({ ...prev, isOpen: false, type: null }))
        }
        title="Create New Allowance Type"
        fields={[
          {
            name: "name",
            label: "Allowance Name",
            required: true,
            defaultValue: createModalState.initialValue,
            placeholder: "e.g. Transport",
          },
          {
            name: "description",
            label: "Description",
            required: true,
            type: "textarea",
            placeholder: "Describe this allowance",
          },
          {
            name: "is_taxable",
            label: "Is Taxable?",
            type: "checkbox",
          },
        ]}
        onSubmit={handleCreateSubmit}
        initialValues={{ name: createModalState.initialValue }}
      /> */}
    </AdminLayout >
  );
}
