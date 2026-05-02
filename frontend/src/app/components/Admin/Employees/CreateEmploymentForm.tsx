import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Button from "../../Core/ui/Button";
import FormField from "../../common/FormField";
// HrisSpinner replaced by generic spinner
import {
  FiCalendar,
  FiDollarSign,
  FiUser,
  FiBriefcase,
  FiLayers,
} from "react-icons/fi";
import adminService, { AllowanceType } from "../../../services/adminService";
import ToastService from "../../../../utils/ToastService";

// Slices
import { useCreateEmploymentSlice } from "../../../pages/Admin/CreateEmployment/slice";
import { useJobTitlesSlice } from "../../../pages/Admin/Settings/JobTitles/slice";
import { useDepartments } from "../../../pages/Admin/Departments/slice";

// Selectors
import {
  selectCreateEmploymentLoading,
  selectCreateEmploymentError,
  selectCreateEmploymentSuccess,
} from "../../../pages/Admin/CreateEmployment/slice/selectors";
import { selectAllJobTitles } from "../../../pages/Admin/Settings/JobTitles/slice/selectors";
import {
  selectDepartments,
  selectDepartmentsLoading,
} from "../../../pages/Admin/Departments/slice/selectors";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";

interface CreateEmploymentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateEmploymentForm({
  onSuccess,
  onCancel,
}: CreateEmploymentFormProps) {
  const dispatch = useDispatch();

  // Hooks
  const { actions: createActions } = useCreateEmploymentSlice();
  const { actions: jobTitleActions } = useJobTitlesSlice();
  const { actions: departmentActions } = useDepartments();

  // Selectors
  const loading = useSelector(selectCreateEmploymentLoading);
  const error = useSelector(selectCreateEmploymentError);
  const success = useSelector(selectCreateEmploymentSuccess);
  const jobTitles = useSelector(selectAllJobTitles);
  const departments = useSelector(selectDepartments);
  const departmentsLoading = useSelector(selectDepartmentsLoading);

  const [form, setForm] = useState({
    employee_id: "",
    department_name: "",
    department_id: "",
    employment_type: "Full Time",
    start_date: "",
    gross_salary: "",
    basic_salary: "",
    transportation_allowance: "",
    housing_allowance: "",
    meal_allowance: "",
    manager_id: "",
  });
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);

  // Job Title State
  const [jobTitleInput, setJobTitleInput] = useState({ title: "", level: "" });
  const [filteredTitles, setFilteredTitles] = useState<string[]>([]);
  const [filteredLevels, setFilteredLevels] = useState<string[]>([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [showLevelSuggestions, setShowLevelSuggestions] = useState(false);

  // Department State
  const [filteredDepartments, setFilteredDepartments] = useState<string[]>([]);
  const [showDepartmentSuggestions, setShowDepartmentSuggestions] =
    useState(false);

  const employmentTypes = ["Full Time", "Part-Time", "Contract", "Outsourced"];

  // Fetch dependencies on mount
  useEffect(() => {
    dispatch(jobTitleActions.fetchAllJobTitlesRequest());
    dispatch(departmentActions.fetchDepartmentsStart());
    adminService.getAllowanceTypes().then(setAllowanceTypes).catch(console.error);
  }, [dispatch, jobTitleActions, departmentActions]);

  // Handle Success/Error
  useEffect(() => {
    if (success) {
      ToastService.success("Employment record created successfully!");
      setForm({
        employee_id: "",
        department_name: "",
        department_id: "",
        employment_type: "Full Time",
        start_date: "",
        gross_salary: "",
        basic_salary: "",
        transportation_allowance: "",
        housing_allowance: "",
        meal_allowance: "",
        manager_id: "",
      });
      setJobTitleInput({ title: "", level: "" });
      dispatch(createActions.resetState());
      onSuccess();
    }
  }, [success, dispatch, createActions, onSuccess]);

  useEffect(() => {
    if (error) {
      ToastService.error(error);
    }
  }, [error]);

  // Filter job titles for autocomplete
  useEffect(() => {
    const uniqueTitles = Array.from(
      new Set(
        jobTitles
          .map((j) => j?.title)
          .filter((t) => typeof t === "string" && t.trim() !== "")
      )
    );

    if (jobTitleInput.title) {
      const filtered = uniqueTitles.filter((t) =>
        t.toLowerCase().includes(jobTitleInput.title.toLowerCase())
      );
      setFilteredTitles(filtered);
    } else {
      setFilteredTitles(uniqueTitles);
    }
  }, [jobTitleInput.title, jobTitles]);

  // Filter job levels based on selected title
  useEffect(() => {
    if (jobTitleInput.title) {
      const levelsForTitle = jobTitles
        .filter(
          (j) =>
            j.title.toLowerCase() === jobTitleInput.title.toLowerCase() &&
            j.level
        )
        .map((j) => j.level as string)
        .filter((l) => typeof l === "string" && l.trim() !== "");

      const uniqueLevels = Array.from(new Set(levelsForTitle));

      if (jobTitleInput.level) {
        const filtered = uniqueLevels.filter((l) =>
          l.toLowerCase().includes(jobTitleInput.level.toLowerCase())
        );
        setFilteredLevels(filtered);
      } else {
        setFilteredLevels(uniqueLevels);
      }
    } else {
      setFilteredLevels([]);
    }
  }, [jobTitleInput.title, jobTitleInput.level, jobTitles]);

  // Filter departments for autocomplete
  useEffect(() => {
    const uniqueDepts = Array.from(
      new Set(
        (departments || [])
          .map((d: any) => d?.name)
          .filter((name: any) => typeof name === "string" && name.trim() !== "")
      )
    );

    if (form.department_name) {
      const filtered = uniqueDepts.filter((d: any) =>
        d.toLowerCase().includes(form.department_name.toLowerCase())
      );
      setFilteredDepartments(filtered);
    } else {
      setFilteredDepartments(uniqueDepts);
    }
  }, [form.department_name, departments]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "department_name") {
      setShowDepartmentSuggestions(true);
      setForm((prev) => ({ ...prev, department_id: "" }));
    }
  };

  const handleJobTitleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setJobTitleInput((prev) => ({ ...prev, [name]: value }));
    if (name === "title") setShowTitleSuggestions(true);
    if (name === "level") setShowLevelSuggestions(true);
  };

  const selectTitleSuggestion = (title: string) => {
    setJobTitleInput((prev) => ({ ...prev, title }));
    setShowTitleSuggestions(false);
  };

  const selectLevelSuggestion = (level: string) => {
    setJobTitleInput((prev) => ({ ...prev, level }));
    setShowLevelSuggestions(false);
  };

  const selectDepartmentSuggestion = (department: string) => {
    const existingDept = (departments || []).find(
      (d: any) => d?.name?.toLowerCase() === department.toLowerCase()
    );
    setForm((prev) => ({
      ...prev,
      department_name: department,
      department_id: existingDept?.id ? String(existingDept.id) : "",
    }));
    setShowDepartmentSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let finalJobTitleId: number | undefined;
      let finalDepartmentId: number | undefined;

      // --- Job Title Logic ---
      const existingJob = jobTitles.find(
        (j) =>
          j.title.toLowerCase() === jobTitleInput.title.toLowerCase() &&
          j.level?.toLowerCase() === jobTitleInput.level.toLowerCase()
      );

      if (existingJob) {
        finalJobTitleId = existingJob.id;
      } else {
        ToastService.info("Creating new job title...");
        const response: any = await makeCall({
          method: "POST",
          route: apiRoutes.jobTitles,
          body: { title: jobTitleInput.title, level: jobTitleInput.level },
          isSecureRoute: true,
        });

        if (response?.data?.data?.jobTitle?.id) {
          finalJobTitleId = response.data.data.jobTitle.id;
          ToastService.success("New job title created!");
          dispatch(jobTitleActions.fetchAllJobTitlesRequest());
        } else {
          throw new Error("Failed to create new job title");
        }
      }

      if (!finalJobTitleId) {
        throw new Error("Job title is required");
      }

      // --- Department Logic ---
      if (form.department_id) {
        finalDepartmentId = Number(form.department_id);
      }

      if (!finalDepartmentId && form.department_name) {
        const existingDept = (departments || []).find(
          (d: any) =>
            d?.name?.toLowerCase() === form.department_name.toLowerCase()
        );

        if (existingDept?.id) {
          finalDepartmentId = existingDept.id;
        } else {
          ToastService.info(
            `Creating new department: ${form.department_name}...`
          );
          const deptResponse: any = await makeCall({
            method: "POST",
            route: apiRoutes.departments,
            body: { name: form.department_name },
            isSecureRoute: true,
          });

          const createdDeptId = deptResponse?.data?.data?.department?.id;
          if (createdDeptId) {
            finalDepartmentId = createdDeptId;
            ToastService.success("New department created!");
            dispatch(departmentActions.fetchDepartmentsStart());
          } else {
            throw new Error("Failed to create new department");
          }
        }
      }

      if (!finalDepartmentId) {
        throw new Error("Department is required");
      }

      const allowancesList = [];
      if (form.transportation_allowance) {
        const type = allowanceTypes.find(t => t.name.toLowerCase().includes('transport'));
        if (type) allowancesList.push({ allowance_type_id: type.id, amount: parseFloat(form.transportation_allowance) });
      }
      if (form.housing_allowance) {
        const type = allowanceTypes.find(t => t.name.toLowerCase().includes('hous'));
        if (type) allowancesList.push({ allowance_type_id: type.id, amount: parseFloat(form.housing_allowance) });
      }
      if (form.meal_allowance) {
        const type = allowanceTypes.find(t => t.name.toLowerCase().includes('meal'));
        if (type) allowancesList.push({ allowance_type_id: type.id, amount: parseFloat(form.meal_allowance) });
      }

      dispatch(
        createActions.createEmploymentRequest({
          employee_id: form.employee_id,
          employment_type: form.employment_type,
          start_date: form.start_date,
          gross_salary: parseFloat(form.gross_salary),
          basic_salary: parseFloat(form.basic_salary),
          allowances: allowancesList,
          department_id: finalDepartmentId,
          job_title_id: finalJobTitleId,
          manager_id: form.manager_id || undefined,
        })
      );
    } catch (err: any) {
      ToastService.error(err.message || "Failed to process request");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section: Employee & Manager */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          label="Employee ID"
          name="employee_id"
          value={form.employee_id}
          onChange={handleChange}
          required
          placeholder="e.g. EMP-001"
          icon={FiUser}
        />
        <FormField
          label="Manager ID (Optional)"
          name="manager_id"
          value={form.manager_id}
          onChange={handleChange}
          placeholder="e.g. EMP-005"
          icon={FiUser}
        />
      </div>

      {/* Section: Job Title & Level (Autocomplete) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Job Title */}
        <div className="relative">
          <FormField
            label="Job Title"
            name="title"
            value={jobTitleInput.title}
            onChange={handleJobTitleChange}
            required
            placeholder="e.g. Software Engineer"
            autoComplete="off"
            onFocus={() => setShowTitleSuggestions(true)}
            icon={FiBriefcase}
          />
          {showTitleSuggestions && filteredTitles.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
              {filteredTitles.map((title, idx) => (
                <li
                  key={idx}
                  onClick={() => selectTitleSuggestion(title)}
                  className="px-4 py-2 hover:bg-orange-50 cursor-pointer text-sm text-gray-700"
                >
                  {title}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Job Level */}
        <div className="relative">
          <FormField
            label="Job Level"
            name="level"
            value={jobTitleInput.level}
            onChange={handleJobTitleChange}
            placeholder="e.g. Senior, Junior"
            icon={FiLayers}
            autoComplete="off"
            onFocus={() => setShowLevelSuggestions(true)}
          />
          {showLevelSuggestions && filteredLevels.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
              {filteredLevels.map((level, idx) => (
                <li
                  key={idx}
                  onClick={() => selectLevelSuggestion(level)}
                  className="px-4 py-2 hover:bg-orange-50 cursor-pointer text-sm text-gray-700"
                >
                  {level}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Section: Department (Autocomplete) */}
      <div className="relative">
        <FormField
          label="Department"
          name="department_name"
          value={form.department_name}
          onChange={handleChange}
          required
          placeholder="e.g. Engineering"
          icon={() => (
            <div className="text-gray-400">
              {departmentsLoading ? <div className="w-8 h-3 shimmer-bg rounded" /> : <FiLayers />}
            </div>
          )}
          autoComplete="off"
          onFocus={() => setShowDepartmentSuggestions(true)}
        />
        {showDepartmentSuggestions && filteredDepartments.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
            {filteredDepartments.map((dept, idx) => (
              <li
                key={idx}
                onClick={() => selectDepartmentSuggestion(dept)}
                className="px-4 py-2 hover:bg-orange-50 cursor-pointer text-sm text-gray-700"
              >
                {dept}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Section: Employment Type & Compensation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          label="Employment Type"
          name="employment_type"
          type="select"
          value={form.employment_type}
          onChange={handleChange}
          required
          icon={FiBriefcase}
          options={employmentTypes.map((t) => ({ label: t, value: t }))}
        />

        <FormField
          label="Gross Salary"
          type="number"
          name="gross_salary"
          value={form.gross_salary}
          onChange={handleChange}
          required
          placeholder="e.g. 50000"
          icon={FiDollarSign}
        />

        <FormField
          label="Basic Salary"
          type="number"
          name="basic_salary"
          value={form.basic_salary}
          onChange={handleChange}
          required
          placeholder="e.g. 15000"
          icon={FiDollarSign}
        />

        <FormField
          label="Transportation Allowance"
          type="number"
          name="transportation_allowance"
          value={form.transportation_allowance}
          onChange={handleChange}
          required
          placeholder="e.g. 5000"
          icon={FiDollarSign}
        />

        <FormField
          label="Housing Allowance"
          type="number"
          name="housing_allowance"
          value={form.housing_allowance}
          onChange={handleChange}
          required
          placeholder="e.g. 3000"
          icon={FiDollarSign}
        />

        <FormField
          label="Meal Allowance"
          type="number"
          name="meal_allowance"
          value={form.meal_allowance}
          onChange={handleChange}
          required
          placeholder="e.g. 2000"
          icon={FiDollarSign}
        />
      </div>

      {/* Section: Start Date */}
      <FormField
        label="Start Date"
        type="date"
        name="start_date"
        value={form.start_date}
        onChange={handleChange}
        required
        icon={FiCalendar}
      />

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="secondary" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Create Employment
        </Button>
      </div>
    </form>
  );
}
