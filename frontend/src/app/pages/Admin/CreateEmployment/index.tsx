import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import Button from "../../../components/Core/ui/Button";
import BackButton from "../../../components/common/BackButton";
import FormField from "../../../components/common/FormField";
import FormAutocomplete from "../../../components/Core/ui/FormAutocomplete";
import CreateItemModal from "../../../components/common/CreateItemModal";
import LoadingScreen from "../../../components/Core/ui/LoadingScreen";
import useMinimumDelay from "../../../hooks/useMinimumDelay";
import {
  FiCalendar,
  FiDollarSign,
  FiUser,
  FiBriefcase,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import ToastService from "../../../../utils/ToastService";
import { routeConstants } from "../../../../utils/constants";
import adminService, {
  Department,
  JobTitle,
  AllowanceType,
  Employee,
} from "../../../services/adminService";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import { formatIsoDate } from "../../../utils/dayjs-format";

// Slices
import { useCreateEmploymentSlice } from "./slice";
import {
  selectCreateEmploymentLoading,
  selectCreateEmploymentError,
  selectCreateEmploymentSuccess,
} from "./slice/selectors";

// Types
interface AllowanceEntry {
  name: string;
  amount: string;
}

const EMPLOYMENT_TYPES = [
  { label: "Full Time", value: "Full Time" },
  { label: "Part Time", value: "Part Time" },
  { label: "Contract", value: "Contract" },
  { label: "Internship", value: "Internship" },
  { label: "Freelance", value: "Freelance" },
];

export default function CreateEmployment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const prefillEmployeeId = searchParams.get("employeeId") || "";
  const employmentIdParam = searchParams.get("employmentId");
  const employmentId = employmentIdParam ? Number(employmentIdParam) : null;

  // Slices
  const { actions: createActions } = useCreateEmploymentSlice();

  const loading = useSelector(selectCreateEmploymentLoading);
  const error = useSelector(selectCreateEmploymentError);
  const success = useSelector(selectCreateEmploymentSuccess);

  // Dropdown Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Form State
  const [form, setForm] = useState({
    employee_id: prefillEmployeeId,
    departmentName: "",
    jobTitleName: "",
    employment_type: "Full Time",
    start_date: formatIsoDate(new Date()),
    gross_salary: "",
    basic_salary: "",
    manager_id: "",
  });

  const [allowances, setAllowances] = useState<AllowanceEntry[]>([]);

  // Modal State
  const [createModalState, setCreateModalState] = useState<{
    isOpen: boolean;
    type: "department" | "jobTitle" | "allowance" | null;
    initialValue: string;
    targetIndex?: number;
  }>({
    isOpen: false,
    type: null,
    initialValue: "",
  });

  // Fetch Dropdown Data
  const fetchDropdownData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [depts, jobs, allowTypes, emps] = await Promise.all([
        adminService.getDepartments(),
        adminService.getJobTitles(),
        adminService.getAllowanceTypes(),
        adminService.getEmployees(),
      ]);
      setDepartments(depts);
      setJobTitles(jobs);
      setAllowanceTypes(allowTypes);
      setEmployees(emps);
    } catch (err) {
      console.error("Failed to fetch dropdown data:", err);
      ToastService.error("Failed to load form data.");
    } finally {
      // If not updating or if prefill fails, we stop loading here.
      // If updating, fetchEmployment will handle its own loading logic or run parallel.
      if (!employmentId) setIsLoadingData(false);
    }
  }, [employmentId]);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  // Fetch Existing Employment (Update Mode)
  useEffect(() => {
    const fetchEmployment = async () => {
      if (!employmentId) return;

      try {
        // Ensure dropdowns are loaded first or concurrently, handled by keeping isLoadingData true initially
        const response: any = await makeCall({
          method: "GET",
          route: apiRoutes.employmentById(employmentId),
          isSecureRoute: true,
        });

        const emp =
          response?.data?.employment || response?.data?.data?.employment;
        if (!emp) throw new Error("Employment not found");

        const dept =
          departments.find(
            (d) => d.id === (emp.department_id ?? emp.department?.id),
          ) || (emp.department ? { name: emp.department.name } : null);

        const job =
          jobTitles.find(
            (j) => j.id === (emp.job_title_id ?? emp.jobTitle?.id),
          ) || (emp.jobTitle ? { title: emp.jobTitle.title } : null); // Simple fallback

        setForm((prev) => ({
          ...prev,
          employee_id: emp.employee_id || prev.employee_id,
          departmentName: dept?.name || "",
          jobTitleName: job?.title || "", // Note: if job title has level, we might just use title. Autocomplete handles exact match.
          employment_type: emp.employment_type || "Full Time",
          start_date: emp.start_date
            ? emp.start_date.split("T")[0]
            : prev.start_date,
          gross_salary: String(emp.gross_salary || ""),
          basic_salary: String(emp.basic_salary || ""),
          manager_id: emp.manager_id || "",
        }));

        // Map Allowances
        const mappedAllowances: AllowanceEntry[] = [];

        // Check for modern allowances array
        if (emp.allowances && Array.isArray(emp.allowances)) {
          emp.allowances.forEach((a: any) => {
            const typeName =
              a.allowanceType?.name ||
              allowanceTypes.find((at) => at.id === a.allowance_type_id)?.name;
            if (typeName) {
              mappedAllowances.push({
                name: typeName,
                amount: String(a.amount),
              });
            }
          });
        } else {
          // Fallback to legacy fields if backend returns them
          if (Number(emp.transportation_allowance) > 0)
            mappedAllowances.push({
              name: "Transport Allowance",
              amount: String(emp.transportation_allowance),
            });
          if (Number(emp.housing_allowance) > 0)
            mappedAllowances.push({
              name: "Housing Allowance",
              amount: String(emp.housing_allowance),
            });
          if (Number(emp.meal_allowance) > 0)
            mappedAllowances.push({
              name: "Meal Allowance",
              amount: String(emp.meal_allowance),
            });
        }

        setAllowances(mappedAllowances);
      } catch (err: any) {
        ToastService.error(err.message || "Failed to load employment.");
      } finally {
        setIsLoadingData(false);
      }
    };

    if (employmentId && departments.length > 0) {
      // Wait for dropdowns to be ready to map IDs to Names
      fetchEmployment();
    } else if (!employmentId) {
      setIsLoadingData(false);
    }
  }, [employmentId, departments, jobTitles, allowanceTypes]); // Re-run when dropdowns load

  // Response Handlers
  useEffect(() => {
    if (success) {
      if (!employmentId) {
        ToastService.success("Employment created successfully!");
        navigate(routeConstants.employees); // Or clear form
      }
      dispatch(createActions.resetState());
    }
  }, [success, requestAnimationFrame, navigate, employmentId]);

  useEffect(() => {
    if (error) ToastService.error(error);
  }, [error]);

  // Helper Logic
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAutocompleteChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAllowanceChange = (
    index: number,
    field: keyof AllowanceEntry,
    value: string,
  ) => {
    const updated = [...allowances];
    updated[index][field] = value;
    setAllowances(updated);
  };

  const addAllowance = () => {
    setAllowances([...allowances, { name: "", amount: "" }]);
  };

  const removeAllowance = (index: number) => {
    setAllowances(allowances.filter((_, i) => i !== index));
  };

  // Filters
  const filterDepartments = async (query: string) =>
    departments
      .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
      .map((d) => d.name);
  const filterJobTitles = async (query: string) =>
    jobTitles
      .filter((j) => j.title.toLowerCase().includes(query.toLowerCase()))
      .map((j) => j.title);
  const filterAllowanceTypes = async (query: string) =>
    allowanceTypes
      .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
      .map((a) => a.name);

  // Creation
  const handleOpenCreateModal = (
    type: "department" | "jobTitle" | "allowance",
    value: string,
    index?: number,
  ) => {
    setCreateModalState({
      isOpen: true,
      type,
      initialValue: value,
      targetIndex: index,
    });
  };

  const handleCreateSubmit = async (values: Record<string, any>) => {
    try {
      if (createModalState.type === "department") {
        const newDept = await adminService.createDepartment(values.name);
        setDepartments((prev) => [...prev, newDept]);
        setForm((prev) => ({ ...prev, departmentName: newDept.name }));
        ToastService.success(`Department "${newDept.name}" created.`);
      } else if (createModalState.type === "jobTitle") {
        const newJob = await adminService.createJobTitle(
          values.title,
          values.level,
        );
        setJobTitles((prev) => [...prev, newJob]);
        setForm((prev) => ({ ...prev, jobTitleName: newJob.title }));
        ToastService.success(`Job Title "${newJob.title}" created.`);
      } else if (createModalState.type === "allowance") {
        const isTaxable =
          values.is_taxable === true || values.is_taxable === "true";
        const newAllowance = await adminService.createAllowanceType({
          name: values.name,
          description: values.description,
          is_taxable: isTaxable,
        });
        setAllowanceTypes((prev) => [...prev, newAllowance]);
        if (typeof createModalState.targetIndex === "number") {
          handleAllowanceChange(
            createModalState.targetIndex,
            "name",
            newAllowance.name,
          );
        }
        ToastService.success(`Allowance Type "${newAllowance.name}" created.`);
      }
    } catch (err: any) {
      ToastService.error(err.message || "Failed to create item.");
    }
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.departmentName ||
      !form.jobTitleName ||
      !form.gross_salary ||
      !form.employee_id
    ) {
      return ToastService.error("Please fill required fields");
    }

    const deptId = departments.find(
      (d) => d.name.toLowerCase() === form.departmentName.toLowerCase(),
    )?.id;
    if (!deptId)
      return ToastService.error(
        "Department not found. Please create it first.",
      );

    const jobId = jobTitles.find(
      (j) => j.title.toLowerCase() === form.jobTitleName.toLowerCase(),
    )?.id;
    if (!jobId)
      return ToastService.error("Job Title not found. Please create it first.");

    const validAllowances = [];
    for (const a of allowances) {
      if (a.name && a.amount) {
        const typeId = allowanceTypes.find(
          (at) => at.name.toLowerCase() === a.name.toLowerCase(),
        )?.id;
        if (!typeId)
          return ToastService.error(`Allowance "${a.name}" not found.`);
        validAllowances.push({
          allowance_type_id: typeId,
          amount: Number(a.amount),
        });
      }
    }

    const basic = Number(form.basic_salary) || 0;
    const gross = Number(form.gross_salary) || 0;
    const allowanceTotal = allowances.reduce(
      (sum, a) => sum + (Number(a.amount) || 0),
      0,
    );

    if (Math.abs(gross - (basic + allowanceTotal)) > 0.01) {
      return ToastService.error(
        `Compensation Mismatch: Base Salary (${basic}) + Allowances (${allowanceTotal}) must equal Gross Salary (${gross}). Difference: ${
          gross - (basic + allowanceTotal)
        }`,
      );
    }

    const payload = {
      employee_id: form.employee_id,
      department_id: deptId,
      job_title_id: jobId,
      manager_id: form.manager_id || undefined,
      employment_type: form.employment_type,
      gross_salary: gross,
      basic_salary: basic,
      start_date: form.start_date,
      allowances: validAllowances,
    };

    try {
      if (employmentId) {
        setIsUpdating(true);
        await makeCall({
          method: "PUT",
          route: apiRoutes.employmentById(employmentId),
          body: payload,
          isSecureRoute: true,
        });
        ToastService.success("Employment updated successfully");
        setIsUpdating(false);
        navigate(routeConstants.employees);
      } else {
        dispatch(createActions.createEmploymentRequest(payload));
      }
    } catch (err: any) {
      ToastService.error(err.message || "Failed to save employment");
      setIsUpdating(false);
    }
  };

  const managerOptions = [
    ...employees.map((e) => ({
      label: `${e.fullName} (${e.id})`,
      value: e.id,
    })),
  ];

  const showLoadingData = useMinimumDelay(isLoadingData, 800);

  if (showLoadingData) {
    return (
      <AdminLayout>
        <LoadingScreen />
      </AdminLayout>
    );
  }

  // Modal Fields
  let modalFields: any[] = [];
  let modalTitle = "";
  if (createModalState.type === "department") {
    modalTitle = "Create New Department";
    modalFields = [
      {
        name: "name",
        label: "Department Name",
        required: true,
        defaultValue: createModalState.initialValue,
      },
    ];
  } else if (createModalState.type === "jobTitle") {
    modalTitle = "Create New Job Title";
    modalFields = [
      {
        name: "title",
        label: "Job Title",
        required: true,
        defaultValue: createModalState.initialValue,
      },
      {
        name: "level",
        label: "Level",
        type: "select",
        required: true,
        options: [
          { label: "Junior", value: "Junior" },
          { label: "Mid", value: "Mid" },
          { label: "Senior", value: "Senior" },
        ],
      },
    ];
  } else if (createModalState.type === "allowance") {
    modalTitle = "Create Allowance Type";
    modalFields = [
      {
        name: "name",
        label: "Name",
        required: true,
        defaultValue: createModalState.initialValue,
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: true,
      },
      { name: "is_taxable", label: "Taxable?", type: "checkbox" },
    ];
  }

  return (
    <AdminLayout>
      <div className="w-full px-6 pb-12">
        <div className="mb-8">
          <BackButton to={routeConstants.employees} label="Back to Employees" />
          <h1 className="text-3xl font-bold text-k-dark-grey">
            {employmentId ? "Update Employment" : "Assign Employment"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Base Info */}
          <div className="bg-white rounded-2xl shadow-card p-8 border border-gray-100">
            <h3 className="text-lg font-semibold text-k-dark-grey mb-6 flex items-center">
              <FiUser className="mr-2 text-primary" /> Employee
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Employee ID"
                name="employee_id"
                value={form.employee_id}
                onChange={(e) => handleChange(e as any)}
                required
                disabled={!!employmentId}
                icon={FiUser}
              />
              <FormField
                label="Manager"
                name="manager_id"
                type="select"
                value={form.manager_id}
                onChange={(e) => handleChange(e as any)}
                options={managerOptions}
                placeholder="Select Manager"
              />
            </div>
          </div>

          {/* 2. Job Info */}
          <div className="bg-white rounded-2xl shadow-card p-8 border border-gray-100">
            <h3 className="text-lg font-semibold text-k-dark-grey mb-6 flex items-center">
              <FiBriefcase className="mr-2 text-primary" /> Job Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormAutocomplete
                label="Job Title"
                type="jobTitles"
                value={form.jobTitleName}
                onChange={(val) =>
                  handleAutocompleteChange("jobTitleName", val)
                }
                fetchSuggestionsFn={filterJobTitles}
                onCreateNew={(val) => handleOpenCreateModal("jobTitle", val)}
                required
                placeholder="Search or create job title"
              />
              <FormAutocomplete
                label="Department"
                type="departments"
                value={form.departmentName}
                onChange={(val) =>
                  handleAutocompleteChange("departmentName", val)
                }
                fetchSuggestionsFn={filterDepartments}
                onCreateNew={(val) => handleOpenCreateModal("department", val)}
                required
                placeholder="Search or create department"
              />
              <FormField
                label="Employment Type"
                name="employment_type"
                type="select"
                value={form.employment_type}
                onChange={(e) => handleChange(e as any)}
                options={EMPLOYMENT_TYPES}
              />
              <FormField
                label="Start Date"
                name="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) => handleChange(e as any)}
                required
                icon={FiCalendar}
              />
            </div>
          </div>

          {/* 3. Compensation */}
          <div className="bg-white rounded-2xl shadow-card p-8 border border-gray-100">
            <h3 className="text-lg font-semibold text-k-dark-grey mb-6 flex items-center">
              <FiDollarSign className="mr-2 text-primary" /> Compensation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <FormField
                label="Gross Salary"
                name="gross_salary"
                type="number"
                value={form.gross_salary}
                onChange={(e) => handleChange(e as any)}
                required
                placeholder="0.00"
              />
              <FormField
                label="Base Salary"
                name="basic_salary"
                type="number"
                value={form.basic_salary}
                onChange={(e) => handleChange(e as any)}
                placeholder="0.00"
              />
            </div>

            <div className="border-t pt-6">
              <h4 className="font-medium text-k-dark-grey mb-4">Allowances</h4>
              <div className="space-y-4 mb-4">
                {allowances.map((allowance, index) => (
                  <div
                    key={index}
                    className="flex gap-4 items-end bg-gray-50 p-3 rounded-xl border border-gray-200"
                  >
                    <div className="flex-1">
                      <FormAutocomplete
                        label={index === 0 ? "Allowance Name" : undefined}
                        type="allowanceTypes"
                        value={allowance.name}
                        onChange={(val) =>
                          handleAllowanceChange(index, "name", val)
                        }
                        fetchSuggestionsFn={filterAllowanceTypes}
                        onCreateNew={(val) =>
                          handleOpenCreateModal("allowance", val, index)
                        }
                        placeholder="e.g. Transport"
                        containerClassName="w-full"
                        required
                      />
                    </div>
                    <div className="w-1/3">
                      <FormField
                        label={index === 0 ? "Amount" : undefined}
                        type="number"
                        name={`allowance_amount_${index}`}
                        value={allowance.amount}
                        onChange={(e) =>
                          handleAllowanceChange(index, "amount", e.target.value)
                        }
                        placeholder="0.00"
                        className="!mb-0"
                        inputClassName="!h-[46px]"
                        required
                      />
                    </div>
                    <div className="pb-1">
                      <button
                        type="button"
                        onClick={() => removeAllowance(index)}
                        className="p-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                        title="Remove"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={addAllowance}
                  className="flex items-center justify-center text-primary font-medium px-4 py-2 border-2 border-dashed border-primary/30 rounded-xl hover:bg-primary-light hover:border-primary transition-all w-full md:w-auto"
                >
                  <FiPlus className="mr-2" /> Add Allowance
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6">
            <Button
              variant="secondary"
              className="mr-4"
              onClick={() => navigate(routeConstants.employees)}
              type="button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading || isUpdating}
              className="w-40"
            >
              {employmentId ? "Update" : "Create"}
            </Button>
          </div>
        </form>

        <CreateItemModal
          isOpen={createModalState.isOpen}
          onClose={() =>
            setCreateModalState((prev) => ({
              ...prev,
              isOpen: false,
              type: null,
            }))
          }
          title={modalTitle}
          fields={modalFields}
          onSubmit={handleCreateSubmit}
          initialValues={{
            name: createModalState.initialValue,
            title: createModalState.initialValue,
          }}
        />
      </div>
    </AdminLayout>
  );
}
