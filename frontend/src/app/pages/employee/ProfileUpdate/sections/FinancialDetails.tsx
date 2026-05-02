import React, { useState, ChangeEvent, FormEvent } from "react";
import FormField from "../../../../components/common/FormField";
import Button from "../../../../components/Core/ui/Button";
import { MdSave, MdAdd, MdDelete, MdAttachMoney, MdEdit } from "react-icons/md";
import toast from "react-hot-toast";

import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import employeeService from "../../../../services/employeeService";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../../slice/authSlice/selectors";

interface FinancialDetail {
  id?: number | string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isPrimary: boolean;
}

interface FinancialDetailsProps {
  initialData?: any[];
  onRefresh?: () => Promise<void> | void;
}

export default function FinancialDetails({
  initialData,
  onRefresh,
}: FinancialDetailsProps) {
  const authUser = useSelector(selectAuthUser) as any;
  const [isEditing, setIsEditing] = useState(false);
  const [banks, setBanks] = useState<any[]>([]);
  const [formData, setFormData] = useState<{ financials: FinancialDetail[] }>({
    financials: initialData && initialData.length > 0 ? initialData : [],
  });

  // Update state when initialData changes (e.g. after fetch)
  React.useEffect(() => {
    if (initialData && initialData.length > 0) {
      setFormData({ financials: initialData });
    }
  }, [initialData]);

  // Fetch banks
  React.useEffect(() => {
    const fetchBanks = async () => {
      try {
        const res = await makeCall({
          route: apiRoutes.BANKS.GET_ALL,
          method: "GET",
          isSecureRoute: true,
        });
        setBanks(res.data?.data?.banks || res.data?.banks || []);
      } catch (err) {
        console.error("Failed to fetch banks", err);
        toast.error("Could not load bank list");
      }
    };
    fetchBanks();
  }, []);

  const handleChange = (
    index: number,
    field: keyof FinancialDetail,
    value: any,
  ) => {
    const newFinancials = [...formData.financials];
    (newFinancials[index] as any)[field] = value;
    setFormData((prev) => ({ ...prev, financials: newFinancials }));
  };

  const addFinancial = () => {
    setFormData((prev) => ({
      ...prev,
      financials: [
        ...prev.financials,
        {
          bankName: "",
          accountNumber: "",
          accountName: "",
          isPrimary: false,
        },
      ],
    }));
  };

  const removeFinancial = (index: number) => {
    if (formData.financials.length > 0) {
      const newFinancials = formData.financials.filter((_, i) => i !== index);
      setFormData((prev) => ({ ...prev, financials: newFinancials }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (formData.financials.length === 0) {
      toast.error("At least one bank account is required");
      return;
    }

    for (const fd of formData.financials) {
      if (!fd.bankName) {
        // using bankName as value from select
        toast.error("Bank is required");
        return;
      }
      if (!fd.accountNumber) {
        toast.error("Account Number is required");
        return;
      }
      if (!/^\d+$/.test(fd.accountNumber)) {
        toast.error("Account Number must be numeric");
        return;
      }
      if (!fd.accountName) {
        toast.error("Account Holder Name is required");
        return;
      }
      if (fd.accountName.trim().split(/\s+/).length !== 3) {
        toast.error(
          "Account Holder Name must contain exactly three words (First Middle Last)",
        );
        return;
      }
    }

    const employeeId = String(
      authUser?.employee_id ?? authUser?.employee?.id ?? "",
    ).trim();

    if (!employeeId) {
      toast.error("Could not determine employee account for update.");
      return;
    }

    try {
      const loadingToast = toast.loading("Saving financial details...");

      const mappedFinancials = formData.financials.map((fd, index) => {
        const bankObj = banks.find(
          (b) =>
            String(b?.name || "").toLowerCase() ===
              String(fd.bankName || "").toLowerCase() ||
            String(b?.id || "") === String(fd.bankName || ""),
        );
        const bankId = bankObj?.id ?? Number(fd.bankName);
        if (!Number.isFinite(Number(bankId)) || Number(bankId) <= 0) {
          throw new Error(
            `Bank selection is invalid for account ${index + 1}. Please select a valid bank.`,
          );
        }

        return {
          id: fd.id,
          bank_id: Number(bankId),
          account_number: fd.accountNumber,
          account_holder_name: fd.accountName,
          is_primary: fd.isPrimary,
        };
      });

      const hasPrimary = mappedFinancials.some((f) => Boolean(f.is_primary));
      if (!hasPrimary && mappedFinancials.length > 0) {
        mappedFinancials[0].is_primary = true;
      }

      await employeeService.updateBankAccounts(employeeId, mappedFinancials);

      toast.dismiss(loadingToast);
      toast.success("Financial details updated successfully");
      setIsEditing(false);

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ||
        (error as Error)?.message ||
        "Failed to update details";
      toast.error(message);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl font-bold text-k-dark-grey">
          Financial Details
        </h2>
        {!isEditing && (
          <Button
            variant="outline"
            icon={MdEdit}
            onClick={() => setIsEditing(true)}
          >
            Edit Details
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-8">
          <div className="flex justify-end mb-4">
            {isEditing && (
              <Button
                type="button"
                variant="subtle"
                onClick={addFinancial}
                icon={MdAdd}
                className="text-primary hover:bg-primary-light"
              >
                Add Bank Account
              </Button>
            )}
          </div>

          <div className="space-y-6">
            {formData.financials.map((financial, index) => (
              <div
                key={index}
                className="bg-gray-50 p-6 rounded-xl border border-gray-200 relative"
              >
                <div className="flex items-center gap-2 mb-4 text-primary font-medium">
                  <MdAttachMoney size={20} />
                  <span>Account {index + 1}</span>
                  {financial.isPrimary && (
                    <span className="text-xs bg-primary-light text-primary px-2 py-1 rounded-full ml-2">
                      Primary
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white"
                      value={financial.bankName}
                      onChange={(e) =>
                        handleChange(index, "bankName", e.target.value)
                      }
                      disabled={!isEditing}
                      required
                    >
                      <option value="">Select Bank</option>
                      {banks.map((bank: any) => (
                        <option key={bank.id} value={bank.name}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <FormField
                    label="Account Number"
                    name={`accountNumber-${index}`}
                    value={financial.accountNumber}
                    onChange={(e) =>
                      handleChange(index, "accountNumber", e.target.value)
                    }
                    disabled={!isEditing}
                    required
                  />

                  <div className="md:col-span-2">
                    <FormField
                      label="Employee Name"
                      name={`accountName-${index}`}
                      value={financial.accountName}
                      onChange={(e) =>
                        handleChange(index, "accountName", e.target.value)
                      }
                      disabled={!isEditing}
                      required
                      helperText="As it appears on your bank book"
                    />
                  </div>
                </div>

                {isEditing && (
                  <button
                    type="button"
                    onClick={() => removeFinancial(index)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-error transition-colors p-2 hover:bg-red-50 rounded-lg"
                    title="Remove"
                  >
                    <MdDelete size={20} />
                  </button>
                )}
              </div>
            ))}

            {formData.financials.length === 0 && (
              <div className="text-center py-8 text-k-medium-grey bg-gray-50 rounded-xl border border-dashed">
                No financial details added yet.
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" icon={MdSave}>
              Save Changes
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
