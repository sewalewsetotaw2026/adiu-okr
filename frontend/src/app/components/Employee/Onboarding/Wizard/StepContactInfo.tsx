import FormInput from "../../../Core/ui/FormInput";
import FormSelect from "../../../Core/ui/FormSelect";
import Button from "../../../Core/ui/Button";
import Checkbox from "../../../Core/ui/Checkbox";
import { MdAdd, MdDelete, MdPhone } from "react-icons/md";

interface StepProps {
  formData: any;
  handleChange: (field: string, value: any) => void;
  updateFormData: (field: string, value: any) => void;
  errors: any;
}

export default function StepContactInfo({
  formData,
  handleChange,
  updateFormData,
}: StepProps) {
  const handlePhoneChange = (index: number, field: string, value: any) => {
    const newPhones = formData.phones.map((phone: any, i: number) =>
      i === index ? { ...phone, [field]: value } : phone
    );
    updateFormData("phones", newPhones);
  };

  const addPhone = () => {
    updateFormData("phones", [
      ...formData.phones,
      { number: "", type: "Mobile", isPrimary: false },
    ]);
  };

  const removePhone = (index: number) => {
    const newPhones = formData.phones.filter(
      (_: any, i: number) => i !== index
    );
    updateFormData("phones", newPhones);
  };

  return (
    <div className="space-y-8 animate-[slideUp_0.3s_ease-out]">
      {/* Address Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            label="Region"
            value={formData.region}
            onChange={(e) => handleChange("region", e.target.value)}
            placeholder="e.g. Addis Ababa"
          />
          <FormInput
            label="City"
            value={formData.city}
            onChange={(e) => handleChange("city", e.target.value)}
            placeholder="e.g. Addis Ababa"
          />
          <FormInput
            label="Sub City"
            value={formData.subCity}
            onChange={(e) => handleChange("subCity", e.target.value)}
            placeholder="e.g. Bole"
          />
          <FormInput
            label="Woreda"
            value={formData.woreda}
            onChange={(e) => handleChange("woreda", e.target.value)}
            placeholder="e.g. 03"
          />
        </div>
      </div>

      {/* Phone Numbers Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Phone Numbers
        </h3>
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            onClick={addPhone}
            className="text-sm flex items-center"
          >
            <MdAdd className="mr-1" /> Add Phone
          </Button>
        </div>

        {formData.phones.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <MdPhone className="mx-auto h-10 w-10 text-gray-400 mb-2" />
            <p className="text-gray-500">No phone numbers added.</p>
          </div>
        )}

        <div className="space-y-4">
          {formData.phones.map((phone: any, index: number) => (
            <div
              key={index}
              className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 relative animate-[fadeIn_0.3s_ease-out]"
            >
              {formData.phones.length > 1 && (
                <button
                  onClick={() => removePhone(index)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <MdDelete size={20} />
                </button>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormInput
                  label="Phone Number"
                  value={phone.number}
                  onChange={(e) =>
                    handlePhoneChange(index, "number", e.target.value)
                  }
                  placeholder="+251..."
                  required
                />
                <FormSelect
                  label="Type"
                  value={phone.type}
                  onChange={(e) =>
                    handlePhoneChange(index, "type", e.target.value)
                  }
                  options={["Mobile", "Home", "Work"]}
                />
                <div className="flex items-center h-full pb-3">
                  <Checkbox
                    label="Primary Number"
                    checked={phone.isPrimary}
                    onChange={(e) => {
                      // Uncheck others if this is set to primary
                      if (e.target.checked) {
                        const newPhones = formData.phones.map(
                          (p: any, i: number) => ({
                            ...p,
                            isPrimary: i === index,
                          })
                        );
                        updateFormData("phones", newPhones);
                      } else {
                        handlePhoneChange(index, "isPrimary", false);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
