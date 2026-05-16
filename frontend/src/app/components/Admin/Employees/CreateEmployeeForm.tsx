import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useCreateEmployeeSlice } from "../../../pages/Admin/CreateEmployee/slice";
import {
  selectCreateEmployeeLoading,
  selectCreateEmployeeError,
  selectCreateEmployeeSuccess,
} from "../../../pages/Admin/CreateEmployee/slice/selectors";
import FormField from "../../common/FormField";
import Button from "../../Core/ui/Button";
import ToastService from "../../../../utils/ToastService";
import {
  FiUser,
  FiCalendar,
  FiHash,
  FiMapPin,
  FiFileText,
} from "react-icons/fi";

interface CreateEmployeeFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateEmployeeForm({
  onSuccess,
  onCancel,
}: CreateEmployeeFormProps) {
  const dispatch = useDispatch();
  const { actions } = useCreateEmployeeSlice();

  const isLoading = useSelector(selectCreateEmployeeLoading);
  const error = useSelector(selectCreateEmployeeError);
  const success = useSelector(selectCreateEmployeeSuccess);

  const [form, setForm] = useState({
    employee_id: "",
    full_name: "",
    gender: "",
    date_of_birth: "",
    tin_number: "",
    pension_number: "",
    place_of_work: "",
  });

  useEffect(() => {
    if (success) {
      ToastService.success("Employee created successfully!");
      setForm({
        employee_id: "",
        full_name: "",
        gender: "",
        date_of_birth: "",
        tin_number: "",
        pension_number: "",
        place_of_work: "",
      });
      dispatch(actions.resetState());
      onSuccess();
    }
  }, [success, dispatch, actions, onSuccess]);

  useEffect(() => {
    if (error) {
      ToastService.error(error as string);
    }
  }, [error]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(actions.createEmployeeRequest(form));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          label="Employee ID"
          name="employee_id"
          value={form.employee_id}
          onChange={handleChange}
          required
          placeholder="e.g. EMP-001"
          icon={FiHash}
        />
        <FormField
          label="Full Name"
          name="full_name"
          value={form.full_name}
          onChange={handleChange}
          required
          placeholder="e.g. John Doe"
          icon={FiUser}
        />
        <FormField
          label="Gender"
          name="gender"
          type="select"
          value={form.gender}
          onChange={handleChange}
          required
          icon={FiUser}
          options={[
            { label: "Select Gender", value: "" },
            { label: "Male", value: "Male" },
            { label: "Female", value: "Female" },
          ]}
        />
        <FormField
          label="Date of Birth (Gregorian)"
          name="date_of_birth"
          type="date"
          value={form.date_of_birth}
          onChange={handleChange}
          required
          icon={FiCalendar}
        />
        <FormField
          label="TIN Number"
          name="tin_number"
          value={form.tin_number}
          onChange={handleChange}
          placeholder="Tax Identification Number"
          icon={FiFileText}
          required
        />
        <FormField
          label="Pension Number"
          name="pension_number"
          value={form.pension_number}
          onChange={handleChange}
          placeholder="Pension Fund Number"
          icon={FiFileText}
        />
      </div>

      <FormField
        label="Place of Work"
        name="place_of_work"
        value={form.place_of_work}
        onChange={handleChange}
        placeholder="e.g. Addis Ababa HQ"
        icon={FiMapPin}
      />

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="secondary" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button type="submit" loading={isLoading as boolean}>
          Create Employee
        </Button>
      </div>
    </form>
  );
}
