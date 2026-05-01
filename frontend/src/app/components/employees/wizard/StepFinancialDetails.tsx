import { useEffect, useState } from "react";
import FormField from "../../common/FormField";
import Button from "../../Core/ui/Button";
import { MdAdd, MdDelete } from "react-icons/md";
import employeeService from "../../../services/employeeService";
import toast from "react-hot-toast";

interface FinancialDetail {
  bankId: string;
  bankName?: string;
  accountNumber: string;
  accountHolderName: string;
  isPrimary: boolean;
}

interface StepFinancialDetailsProps {
  formData: any;
  updateFormData: (section: string, data: unknown) => void;
  errors?: Record<string, string | null | undefined>;
}

export default function StepFinancialDetails({
  formData,
  updateFormData,
  errors = {},
}: StepFinancialDetailsProps) {
  const [banks, setBanks] = useState<any[]>([]);

  useEffect(() => {
    const fetchBanks = async () => {
        try {
          const data = await employeeService.getBanks();
          setBanks(data);
        } catch (error) {
          toast.error("Failed to fetch banks.");
          console.error("Failed to fetch banks", error);
        }
    };
    fetchBanks();
  }, []);

  const handleChange = (
    index: number,
    field: keyof FinancialDetail,
    value: string | boolean,
  ) => {
    const newDetails = [...(formData.financialDetails || [])];
    let finalValue = value;

    // Enforce numeric only for account numbers
    if (field === "accountNumber" && typeof value === "string") {
      finalValue = value.replace(/\D/g, "");
    }

    if (field === "bankId") {
      const bank = banks.find((b) => String(b.id) === String(value));
      newDetails[index] = {
        ...newDetails[index],
        bankId: String(value),
        bankName: bank?.name || "",
      } as FinancialDetail;
    } else {
      newDetails[index] = {
        ...newDetails[index],
        [field]: finalValue,
      } as FinancialDetail;
    }
    updateFormData("financialDetails", newDetails);
  };

  const addDetail = () => {
    const current = formData.financialDetails || [];
    updateFormData("financialDetails", [
      ...current,
      {
        bankId: "",
        bankName: "",
        accountNumber: "",
        accountHolderName: "",
        isPrimary: current.length === 0,
      },
    ]);
  };

  const removeDetail = (index: number) => {
    const current = formData.financialDetails || [];
    const newDetails = current.filter((_: any, i: number) => i !== index);
    if (current[index].isPrimary && newDetails.length > 0) {
      newDetails[0].isPrimary = true;
    }
    updateFormData("financialDetails", newDetails);
  };

  // Initialize with one empty detail if none exist
  useEffect(() => {
    if (!formData.financialDetails || formData.financialDetails.length === 0) {
      updateFormData("financialDetails", [
        {
          bankId: "",
          bankName: "",
          accountNumber: "",
          accountHolderName: "",
          isPrimary: true,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-k-dark-grey">
          Financial Details
        </h3>
        <Button
          variant="secondary"
          onClick={addDetail}
          icon={MdAdd}
          className="py-2! px-4! h-10! text-sm cursor-pointer"
        >
          Add Bank Account
        </Button>
      </div>

      {errors.financialDetails && (
        <p className="text-error text-sm mb-4">{errors.financialDetails}</p>
      )}

      <div className="space-y-4">
        {(formData.financialDetails || []).map(
          (detail: FinancialDetail, index: number) => (
            <div
              key={index}
              className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Bank"
                  type="select"
                  name={`fd_${index}_bank`}
                  value={detail.bankId}
                  onChange={(e) =>
                    handleChange(
                      index,
                      "bankId",
                      (e.target as HTMLSelectElement).value,
                    )
                  }
                  required
                  error={errors[`fd_${index}_bank`] ?? undefined}
                >
                  <option value="">Select Bank</option>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}
                    </option>
                  ))}
                </FormField>
                <FormField
                  label="Account Number"
                  name={`fd_${index}_accNum`}
                  value={detail.accountNumber}
                  onChange={(e) =>
                    handleChange(
                      index,
                      "accountNumber",
                      (e.target as HTMLInputElement).value,
                    )
                  }
                  placeholder="Account Number"
                  required
                  error={errors[`fd_${index}_accNum`] ?? undefined}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Account Holder Name"
                  name={`fd_${index}_accName`}
                  value={detail.accountHolderName}
                  onChange={(e) =>
                    handleChange(
                      index,
                      "accountHolderName",
                      (e.target as HTMLInputElement).value,
                    )
                  }
                  placeholder="Account Holder Name"
                  required
                  error={errors[`fd_${index}_accName`] ?? undefined}
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="primaryFinancial"
                    checked={detail.isPrimary}
                    onChange={() => {
                      const newDetails = (
                        formData.financialDetails as FinancialDetail[]
                      ).map((d, i) => ({
                        ...d,
                        isPrimary: i === index,
                      }));
                      updateFormData("financialDetails", newDetails);
                    }}
                    className="w-5 h-5 text-k-orange focus:ring-k-orange cursor-pointer"
                  />
                  <span className="text-sm text-k-dark-grey">
                    Primary Account
                  </span>
                </label>
              </div>

              {(formData.financialDetails || []).length > 1 && (
                <button
                  onClick={() => removeDetail(index)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-error transition-colors cursor-pointer"
                  title="Remove Account"
                >
                  <MdDelete size={20} />
                </button>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
