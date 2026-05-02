import FormField from "../../common/FormField";
import Button from "../../Core/ui/Button";
import PhoneNumberInput from "../../Core/ui/PhoneNumberInput";
import { MdAdd, MdDelete } from "react-icons/md";
import { useEffect } from "react";

type PhoneType = "Private" | "Office" | "Home" | "Emergency" | "Other";

interface ContactPhone {
  number: string;
  type: PhoneType;
  isPrimary: boolean;
}

interface EmergencyContact {
  fullName: string;
  relationship: string;
  phoneNumber: string;
  email: string;
  isPrimary: boolean;
}

interface StepContactInfoProps {
  formData: any;
  handleChange: (field: string, value: unknown) => void;
  updateFormData: (section: string, data: unknown) => void;
  errors?: Record<string, string | null | undefined>;
}

export default function StepContactInfo({
  formData,
  handleChange,
  updateFormData,
  errors = {},
}: StepContactInfoProps) {
  
  // Ensure at least one emergency contact exists on mount
  useEffect(() => {
     if (!formData.emergencyContacts || formData.emergencyContacts.length === 0) {
         updateFormData("emergencyContacts", [
            { fullName: "", relationship: "", phoneNumber: "", email: "", isPrimary: true },
         ]);
     }
  }, []);

  const handleAddressChange = (field: string, value: string) => {
    handleChange(field, value);
  };

  // Phone handlers
  const handlePhoneChange = (
    index: number,
    field: keyof ContactPhone,
    value: string | boolean
  ) => {
    const newPhones = [...(formData.phones as ContactPhone[])];
    newPhones[index] = {
      ...newPhones[index],
      [field]: value,
    } as ContactPhone;
    updateFormData("phones", newPhones);
  };

  const addPhone = () => {
    updateFormData("phones", [
      ...formData.phones,
      { number: "", type: "Private", isPrimary: false },
    ]);
  };

  const removePhone = (index: number) => {
    if (formData.phones.length > 1) {
      const newPhones = (formData.phones as ContactPhone[]).filter(
        (_phone: ContactPhone, i: number) => i !== index
      );
      updateFormData("phones", newPhones);
    }
  };

  // Emergency Contact handlers
  const handleECChange = (
    index: number,
    field: keyof EmergencyContact,
    value: string | boolean
  ) => {
    const newContacts = [...(formData.emergencyContacts || [])];
    newContacts[index] = {
      ...newContacts[index],
      [field]: value,
    };
    updateFormData("emergencyContacts", newContacts);
  };

  const addEmergencyContact = () => {
    const current = formData.emergencyContacts || [];
    updateFormData("emergencyContacts", [
      ...current,
      { fullName: "", relationship: "", phoneNumber: "", email: "", isPrimary: current.length === 0 },
    ]);
  };

  const removeEmergencyContact = (index: number) => {
    const current = formData.emergencyContacts || [];
    if (current.length > 1) {
      const newContacts = current.filter((_: any, i: number) => i !== index);
       // If removing the primary, set first as primary
       if (current[index].isPrimary && newContacts.length > 0) {
           newContacts[0].isPrimary = true;
       }
      updateFormData("emergencyContacts", newContacts);
    }
  };

  return (
    <div className="space-y-8">
      {/* Address Section */}
      <div>
        <h3 className="text-lg font-semibold text-k-dark-grey mb-4">
          Address Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Region"
            name="region"
            value={formData.region}
            onChange={(e) =>
              handleAddressChange(
                "region",
                (e.target as HTMLInputElement).value
              )
            }
            placeholder="Optional"
          />
          <FormField
            label="City"
            name="city"
            value={formData.city}
            onChange={(e) =>
              handleAddressChange("city", (e.target as HTMLInputElement).value)
            }
            placeholder="Optional"
          />
          <FormField
            label="Sub City"
            name="subCity"
            value={formData.subCity}
            onChange={(e) =>
              handleAddressChange(
                "subCity",
                (e.target as HTMLInputElement).value
              )
            }
            placeholder="Optional"
          />
          <FormField
            label="Woreda"
            name="woreda"
            value={formData.woreda}
            onChange={(e) =>
              handleAddressChange(
                "woreda",
                (e.target as HTMLInputElement).value
              )
            }
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Phone Numbers Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-k-dark-grey">
            Phone Numbers
          </h3>
          <Button
            variant="secondary"
            onClick={addPhone}
            icon={MdAdd}
            className="py-2! px-4! h-10! text-sm cursor-pointer"
          >
            Add Phone
          </Button>
        </div>
        {errors.phones && (
          <p className="text-error text-sm mb-4">{errors.phones}</p>
        )}

        <div className="space-y-4">
          {(formData.phones as ContactPhone[]).map(
            (phone: ContactPhone, index: number) => (
              <div
                key={index}
                className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative"
              >
                <div className="flex flex-col md:flex-row gap-4 md:items-start">
                  {/* Phone Number */}
                  <div className="flex-[2]">
                    <PhoneNumberInput
                        label="Phone Number"
                        value={phone.number}
                        onChange={(val) => handlePhoneChange(index, "number", val)}
                        required
                        error={errors[`phone_${index}`] ?? undefined}
                    />
                  </div>

                  <div className="flex-1 min-w-[140px]">
                    <FormField
                      label="Type"
                      type="select"
                      name={`phones.${index}.type`}
                      value={phone.type}
                      onChange={(e) =>
                        handlePhoneChange(
                          index,
                          "type",
                          (e.target as HTMLSelectElement).value
                        )
                      }
                      containerClassName="mb-0" // remove bottom margin if present in FormField to align
                    >
                      <option value="Private">Private</option>
                      <option value="Office">Office</option>
                      <option value="Home">Home</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Other">Other</option>
                    </FormField>
                  </div>

                  <div className="flex items-center pt-2 md:pt-9 pb-2">
                    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                      <input
                        type="radio"
                        name="primaryPhone"
                        checked={phone.isPrimary}
                        onChange={() => {
                          const newPhones = (
                            formData.phones as ContactPhone[]
                          ).map((p: ContactPhone, i: number) => ({
                            ...p,
                            isPrimary: i === index,
                          }));
                          updateFormData("phones", newPhones);
                        }}
                        className="w-5 h-5 text-k-orange focus:ring-k-orange cursor-pointer"
                      />
                      <span className="text-sm text-k-dark-grey">
                        Primary Number
                      </span>
                    </label>
                  </div>
                </div>

                {formData.phones.length > 1 && (
                  <button
                    onClick={() => removePhone(index)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-error transition-colors cursor-pointer"
                    title="Remove Phone"
                  >
                    <MdDelete size={20} />
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Emergency Contacts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-k-dark-grey">
            Emergency Contacts <span className="text-red-500">*</span>
          </h3>
          <Button
            variant="secondary"
            onClick={addEmergencyContact}
            icon={MdAdd}
            className="py-2! px-4! h-10! text-sm cursor-pointer"
          >
            Add Contact
          </Button>
        </div>
        {errors.emergencyContacts && (
          <p className="text-error text-sm mb-4">{errors.emergencyContacts}</p>
        )}

        <div className="space-y-4">
          {((formData.emergencyContacts || []) as EmergencyContact[]).map(
            (contact: EmergencyContact, index: number) => (
              <div
                key={index}
                className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative space-y-4"
              >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        label="Full Name"
                        name={`ec_${index}_fullName`}
                        value={contact.fullName}
                        onChange={(e) => handleECChange(index, "fullName", (e.target as HTMLInputElement).value)}
                        placeholder="Full Name"
                        required
                        error={errors[`ec_${index}_name`] ?? undefined}
                     />
                     <FormField
                        label="Relationship"
                        name={`ec_${index}_relationship`}
                        value={contact.relationship}
                        onChange={(e) => handleECChange(index, "relationship", (e.target as HTMLInputElement).value)}
                        placeholder="e.g. Spouse, Parent"
                        required
                        error={errors[`ec_${index}_rel`] ?? undefined}
                     />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <PhoneNumberInput
                        label="Phone Number"
                        value={contact.phoneNumber}
                        onChange={(val) => handleECChange(index, "phoneNumber", val)}
                        required
                        error={errors[`ec_${index}_phone`] ?? undefined}
                     />
                     <FormField
                        label="Email"
                        name={`ec_${index}_email`}
                        value={contact.email || ""}
                        onChange={(e) => handleECChange(index, "email", (e.target as HTMLInputElement).value)}
                        placeholder="Optional"
                     />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="primaryEmergency"
                        checked={contact.isPrimary}
                        onChange={() => {
                          const newContacts = (formData.emergencyContacts as EmergencyContact[]).map((c, i) => ({
                              ...c,
                              isPrimary: i === index
                          }));
                          updateFormData("emergencyContacts", newContacts);
                        }}
                        className="w-5 h-5 text-k-orange focus:ring-k-orange cursor-pointer"
                      />
                      <span className="text-sm text-k-dark-grey">
                        Primary Emergency Contact
                      </span>
                    </label>
                  </div>

                  {/* Delete Button - Only show if more than 1, OR if we allow 0 but warn. User wants fields to show by default. */}
                  {(formData.emergencyContacts || []).length > 1 && ( 
                  <button
                    onClick={() => removeEmergencyContact(index)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-error transition-colors cursor-pointer"
                    title="Remove Contact"
                  >
                    <MdDelete size={20} />
                  </button>
                  )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
