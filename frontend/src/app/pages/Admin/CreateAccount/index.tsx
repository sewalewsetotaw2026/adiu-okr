import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../../components/DefaultLayout/AdminLayout";
import FormField from "../../../components/common/FormField";
import FormAutocomplete from "../../../components/Core/ui/FormAutocomplete";
import Button from "../../../components/Core/ui/Button";
import Card from "../../../components/Core/ui/Card";
import DynamicAutocomplete from "../../../components/Core/ui/FormAutocomplete";
import CreateItemModal from "../../../components/common/CreateItemModal";
import {
  FiMail,
  FiBriefcase,
  FiLayers,
  FiCalendar,
  FiDollarSign,
  FiPlus,
  FiTrash2,
  FiArrowLeft,
  FiUser,
} from "react-icons/fi";

import { USER_ROLES } from "../../../../utils/constants";
import ToastService from "../../../../utils/ToastService";
import roleService from "../../../services/roleService";
import adminService, {
  AllowanceType,
  Department,
  JobTitle,
} from "../../../services/adminService";

import { useCreateAccountSlice } from "./slice";
import {
  selectCreateAccountError,
  selectCreateAccountLoading,
  selectCreateAccountSuccess,
} from "./slice/selectors";
import { employeesActions } from "../Employees/slice";

export default function CreateUserPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { actions } = useCreateAccountSlice();

  const [form, setForm] = useState({
    email: "",
    fullName: "",
    role: USER_ROLES.EMPLOYEE,
    department: "",
    departmentId: "" as string | number,
    title: "",
    jobTitleId: "" as string | number,
    level: "",
    employment_type: "Full Time",
    start_date: "",
    gross_salary: "",
    basic_salary: "",
    allowances: [] as { name: string; amount: string; id?: string }[],
    role_id: "" as string | number,
  });

  const [rolesList, setRolesList] = useState<any[]>([]);
  const [fetchingRoles, setFetchingRoles] = useState(false);

  // Modal State

  const loading = useSelector(selectCreateAccountLoading);
  const error = useSelector(selectCreateAccountError);
  const success = useSelector(selectCreateAccountSuccess);

  const roles = useMemo(() => {
    if (rolesList.length > 0) {
      return rolesList.map(r => ({ label: r.name, value: r.name }));
    }
    return [
      { label: "Employee", value: USER_ROLES.EMPLOYEE },
      { label: "HR", value: USER_ROLES.HR },
      { label: "Admin", value: USER_ROLES.ADMIN },
    ];
  }, [rolesList]);

  const resetForm = () => {
    setForm({
      email: "",
      fullName: "",
      role: USER_ROLES.EMPLOYEE,
      department: "",
      title: "",
      level: "",
      employment_type: "Full Time",
      start_date: "",
      gross_salary: "",
      basic_salary: "",
      allowances: [],
      departmentId: "",
      jobTitleId: "",
      role_id: "",
    });
    dispatch(actions.resetState());
  };

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setFetchingRoles(true);
        const res = await roleService.getRoles();
        const list = res.data || [];
        setRolesList(list);

        // Auto-set the first role ID if none set
        if (list.length > 0 && !form.role_id) {
          const defaultRole = list.find((r: any) => r.name === USER_ROLES.EMPLOYEE) || list[0];
          setForm(prev => ({
            ...prev,
            role: defaultRole.name,
            role_id: defaultRole.id
          }));
        }
      } catch (err) {
        console.error("Failed to fetch roles", err);
      } finally {
        setFetchingRoles(false);
      }
    };
    fetchRoles();
  }, []);

  // Success handler
  useEffect(() => {
    if (success) {
      ToastService.success("User account created successfully!");
      dispatch(employeesActions.invalidateCache()); // Force refresh list
      resetForm();
      navigate("/admin/employees"); // Navigate back on success
    }
  }, [success, dispatch, navigate]);

  // Error handler
  useEffect(() => {
    if (error) {
      ToastService.error(error);
    }
  }, [error]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;

    if (name === "role") {
      const selectedRole = rolesList.find(r => r.name === value);
      setForm(prev => ({
        ...prev,
        role: value,
        role_id: selectedRole?.id || ""
      }));
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  // Generic change handler for Autocomplete
  const handleFieldChange = (field: string, value: any, id?: string) => {
    setForm((prev) => {
      const updates: any = { [field]: value };
      if (field === "department") updates.departmentId = id;
      if (field === "title") updates.jobTitleId = id;

      // Special handling for allowances array in form
      if (field.startsWith("allowance_")) {
        const [_, attr, indexStr] = field.split("_");
        const index = parseInt(indexStr);
        const newAllowances = [...prev.allowances];
        if (attr === "name") newAllowances[index].name = value;
        if (attr === "id")
          newAllowances[index].id =
            id || (typeof value === "string" ? value : undefined);
        return { ...prev, allowances: newAllowances };
      }

      return { ...prev, ...updates };
    });
  };

  // Auto-calculate Gross Salary
  useEffect(() => {
    if (form.role) {
      const basic = parseFloat(form.basic_salary) || 0;
      const totalAllowances = form.allowances.reduce((sum, allowance) => {
        return sum + (parseFloat(allowance.amount) || 0);
      }, 0);
      const gross = basic + totalAllowances;
      const formattedGross = gross > 0 ? gross.toFixed(2) : "";

      setForm((prev) => {
        if (prev.gross_salary !== formattedGross) {
          return { ...prev, gross_salary: formattedGross };
        }
        return prev;
      });
    }
  }, [form.basic_salary, form.allowances, form.role]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email?.trim() || !form.fullName?.trim()) {
      ToastService.error("Please provide Full Name and Email.");
      return;
    }

    // Standard submission for all roles including employment details

    // Employee role: build payload matching backend contract (IDs required)
    if (!form.department?.trim() || !form.title?.trim() || !form.start_date) {
      ToastService.error("Please fill Department, Job Title, and Start Date.");
      return;
    }

    if (!form.departmentId || !form.jobTitleId) {
      ToastService.error(
        "Please select or create valid Department and Job Title.",
      );
      return;
    }

    // For allowances:
    const allowancesPayload = (form.allowances || [])
      .filter((a) => a.name && a.amount)
      .map((a) => {
        const typeId = a.id;
        if (!typeId) {
          ToastService.error(
            `Please select or create a valid Allowance Type for "${a.name}".`,
          );
          return null;
        }
        return {
          allowance_type_id: Number(typeId),
          amount: Number(a.amount),
          currency: "ETB",
          effective_date: form.start_date,
        };
      })
      .filter(Boolean);

    dispatch(
      actions.createAccountRequest({
        email: form.email,
        role: form.role,
        role_id: form.role_id ? Number(form.role_id) : undefined,
        employee: {
          fullName: form.fullName,
          employment: {
            employmentType: form.employment_type,
            grossSalary: Number(form.gross_salary) || 0,
            basicSalary: Number(form.basic_salary) || 0,
            departmentId: Number(form.departmentId),
            jobTitleId: Number(form.jobTitleId),
            jobLevel: form.level,
            startDate: form.start_date,
          },
        },
        allowances:
          allowancesPayload.length > 0 ? (allowancesPayload as any) : undefined,
      } as any),
    );
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-20">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/employees")}
            className="flex items-center text-gray-500 hover:text-gray-800 transition-colors"
          >
            <FiArrowLeft className="mr-2" /> Back to Employees
          </button>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Create New User
            </h1>
            <p className="text-gray-500 mt-1">
              Set up a new user account and employment details
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <Card title="Account Information" icon={<FiUser />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  label="Full Name"
                  type="text"
                  name="fullName"
                  placeholder="e.g. Abebe Kebede"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                  icon={FiUser}
                />

                <FormField
                  label="Employee Email"
                  type="email"
                  name="email"
                  placeholder="employee@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  icon={FiMail}
                />

                <FormField
                  label="Role"
                  type="select"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  options={roles}
                  disabled={fetchingRoles}
                />
              </div>
            </Card>

            {form.role && (
              <>
                <Card title="Employment Details" icon={<FiBriefcase />}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormAutocomplete
                      label="Job Title"
                      value={form.title}
                      onChange={(val) => handleFieldChange("title", val)}
                      onIdChange={(id) =>
                        setForm((prev) => ({ ...prev, jobTitleId: id }))
                      }
                      placeholder="e.g. Software Engineer"
                      type="jobTitles"
                      required
                      icon={<FiBriefcase />}
                    />
                    <FormAutocomplete
                      label="Job Level"
                      value={form.level}
                      onChange={(val) => handleFieldChange("level", val)}
                      placeholder="e.g. Senior"
                      type="jobLevels"
                      icon={<FiLayers />}
                      required
                    />
                    <FormAutocomplete
                      label="Department"
                      value={form.department}
                      onChange={(val) => handleFieldChange("department", val)}
                      onIdChange={(id) =>
                        setForm((prev) => ({ ...prev, departmentId: id }))
                      }
                      placeholder="e.g. Engineering"
                      type="departments"
                      required
                    />
                    <FormField
                      label="Employment Type"
                      type="select"
                      name="employment_type"
                      value={form.employment_type}
                      onChange={(e) =>
                        handleFieldChange("employment_type", e.target.value)
                      }
                      options={[
                        { value: "Full Time", label: "Full Time" },
                        { value: "Part-Time", label: "Part-Time" },
                        { value: "Contract", label: "Contract" },
                        { value: "Outsourced", label: "Outsourced" },
                      ]}
                      required
                    />
                    <FormField
                      label="Start Date"
                      type="date"
                      name="start_date"
                      value={form.start_date}
                      onChange={(e) =>
                        handleFieldChange("start_date", e.target.value)
                      }
                      required
                      icon={FiCalendar}
                    />
                  </div>
                </Card>

                <Card title="Compensation" icon={<FiDollarSign />}>
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Gross Salary Display */}
                      {/* Gross Salary Display */}
                      <div className="w-full">
                        <label className="block mb-1.5 font-semibold text-gray-700">
                          Gross Salary
                        </label>
                        <div className="flex items-center justify-center bg-primary-light border border-primary-light rounded-xl px-4 py-3 h-12.5 shadow-sm">
                          <span className="text-lg font-bold text-primary">
                            {form.gross_salary ? form.gross_salary : "0.00"}
                          </span>
                        </div>
                      </div>

                      <FormField
                        label="Basic Salary"
                        type="number"
                        name="basic_salary"
                        min="0"
                        step="0.01"
                        value={form.basic_salary}
                        onChange={(e) =>
                          handleFieldChange("basic_salary", e.target.value)
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>

                    {/* Allowances Section */}
                    <div className="border-t pt-6">
                      <h3 className="text-md font-semibold text-gray-700 mb-4">
                        Allowances
                      </h3>
                      <div className="space-y-4">
                        {form.allowances.map((allowance, index) => (
                          <div key={index} className="flex gap-4 items-end">
                            <div className="flex-1">
                              <DynamicAutocomplete
                                label="Allowance Name"
                                type="allowanceTypes"
                                value={allowance.name}
                                onChange={(val) =>
                                  handleFieldChange(
                                    `allowance_name_${index}`,
                                    val,
                                  )
                                }
                                onIdChange={(id) =>
                                  handleFieldChange(
                                    `allowance_id_${index}`,
                                    undefined,
                                    id,
                                  )
                                }
                                placeholder="e.g. Transport"
                                containerClassName="w-full"
                                required
                              />
                            </div>
                            <div className="flex-1">
                              <FormField
                                label="Amount"
                                type="number"
                                name={`allowance_amount_${index}`}
                                min="0"
                                step="0.01"
                                value={allowance.amount}
                                onChange={(e) => {
                                  const newAllowances = [...form.allowances];
                                  newAllowances[index] = {
                                    ...newAllowances[index],
                                    amount: e.target.value,
                                  };
                                  handleFieldChange(
                                    "allowances",
                                    newAllowances,
                                  );
                                }}
                                placeholder="0.00"
                                required
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newAllowances = form.allowances.filter(
                                  (_, i) => i !== index,
                                );
                                handleFieldChange("allowances", newAllowances);
                              }}
                              className="mb-1 p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors h-12.5 flex items-center justify-center border border-red-200"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange("allowances", [
                              ...form.allowances,
                              { name: "", amount: "" },
                            ]);
                          }}
                          className="flex items-center gap-2 text-sm text-primary font-medium hover:bg-primary-light px-4 py-2 rounded-lg transition-colors border border-dashed border-primary"
                        >
                          <FiPlus /> Add Allowance
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            )}

            <div className="flex justify-end gap-3 pt-6">
              <Button
                type="button"
                onClick={() => navigate("/admin/employees")}
                variant="subtle"
                className="px-6"
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading} className="px-6">
                {loading ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
