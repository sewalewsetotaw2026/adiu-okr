import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import FormField from "../../../../components/common/FormField";
import Button from "../../../../components/Core/ui/Button";
import { MdSave, MdAdd, MdDelete, MdPhone, MdEdit, MdPerson, MdEmail, MdError } from "react-icons/md";
import { FiUser, FiPhone, FiMail } from "react-icons/fi";
import toast from "react-hot-toast";
import onboardingService from "../../../../services/onboardingService";
import employeeService from "../../../../services/employeeService";
import { useSelector } from "react-redux";
import { selectAuthUser } from "../../../../slice/authSlice/selectors";

type PhoneType = "Private" | "Work" | "Home";

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

interface ContactFormData {
  region: string;
  city: string;
  subCity: string;
  woreda: string;
  houseNumber: string;
  phones: ContactPhone[];
  emergencyContacts: EmergencyContact[];
}

interface ContactDetailsProps {
  initialData?: Partial<ContactFormData> | null;
  onRefresh?: () => void | Promise<void>;
}

type ContactFieldName = keyof Omit<ContactFormData, "phones">;

export default function ContactDetails({
  initialData,
  onRefresh,
}: ContactDetailsProps) {
  const user = useSelector(selectAuthUser) as any;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    region: "",
    city: "",
    subCity: "",
    woreda: "",
    houseNumber: "",
    phones: [{ number: "", type: "Private", isPrimary: true }],
    emergencyContacts: []
  });

  useEffect(() => {
    if (!isEditing && initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        phones:
          Array.isArray(initialData.phones) && initialData.phones.length > 0
            ? initialData.phones
            : prev.phones,
        emergencyContacts:
          Array.isArray(initialData.emergencyContacts)
            ? initialData.emergencyContacts
            : prev.emergencyContacts
      }));
    }
  }, [initialData, isEditing]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const fieldName = name as ContactFieldName;
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handlePhoneChange = (
    index: number,
    field: keyof ContactPhone,
    value: ContactPhone[keyof ContactPhone]
  ) => {
    const newPhones = [...formData.phones];
    newPhones[index] = {
      ...newPhones[index],
      [field]: value,
    } as ContactPhone;
    setFormData((prev) => ({ ...prev, phones: newPhones }));
  };

  const addPhone = () => {
    setFormData((prev) => ({
      ...prev,
      phones: [
        ...prev.phones,
        { number: "", type: "Private", isPrimary: false },
      ],
    }));
  };

  const handleEmergencyContactChange = (
    index: number,
    field: keyof EmergencyContact,
    value: any
  ) => {
    const newContacts = [...formData.emergencyContacts];
    newContacts[index] = {
      ...newContacts[index],
      [field]: value
    };
    setFormData(prev => ({ ...prev, emergencyContacts: newContacts }));
  };

  const addEmergencyContact = () => {
    setFormData(prev => ({
      ...prev,
      emergencyContacts: [...prev.emergencyContacts, { fullName: "", relationship: "", phoneNumber: "", email: "", isPrimary: false }]
    }));
  };

  const removeEmergencyContact = (index: number) => {
    const newContacts = formData.emergencyContacts.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, emergencyContacts: newContacts }));
  };

  const removePhone = (index: number) => {
    if (formData.phones.length > 1) {
      const newPhones = formData.phones.filter((_, i) => i !== index);
      setFormData((prev) => ({ ...prev, phones: newPhones }));
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Helper for phone validation
    const validatePhone = (phone: string) => {
      if (!phone) return "Phone number is required";
      const phoneRegex = /^(?:\+\d{7,15}|0\d{9}|251\d{9})$/;
      if (!phoneRegex.test(phone)) {
        return "Invalid phone number format. Must be like +1234567890, 0912345678, or 251912345678.";
      }
      return null;
    };

    // Validation
    if ((formData.phones || []).length === 0) {
      toast.error("At least one phone number is required");
      return;
    }
    for (const p of formData.phones) {
      const err = validatePhone(p.number);
      if (err) {
        toast.error(err);
        return;
      }
    }

    if (!formData.emergencyContacts || formData.emergencyContacts.length === 0) {
      toast.error("At least one emergency contact is required.");
      return;
    }

    for (const ec of formData.emergencyContacts) {
      if (!ec.fullName) {
        toast.error("Emergency Contact Name is required");
        return;
      }
      if (ec.fullName.trim().split(/\s+/).length !== 3) {
        toast.error("Emergency Contact Name must be three words");
        return;
      }
      if (!ec.relationship) {
        toast.error("Emergency Contact Relationship is required");
        return;
      }
      const err = validatePhone(ec.phoneNumber);
      if (err) {
        toast.error(`Emergency Contact: ${err}`);
        return;
      }
    }

    const save = async () => {
      const loadingToast = toast.loading("Saving contact details...");
      try {
        await onboardingService.updateContactInfo({
          region: formData.region || undefined,
          city: formData.city || undefined,
          subCity: formData.subCity || undefined,
          woreda: formData.woreda || undefined,
          phones: (formData.phones || []).map((phone) => ({
            number: phone.number,
            type: phone.type || "Private",
            isPrimary: !!phone.isPrimary,
          })),
          emergencyContacts: (formData.emergencyContacts || []).map(ec => ({
            fullName: ec.fullName,
            relationship: ec.relationship,
            phoneNumber: ec.phoneNumber,
            email: ec.email,
            isPrimary: ec.isPrimary
          }))
        });

        toast.dismiss(loadingToast);
        toast.success("Contact details updated successfully");
        setIsEditing(false);
        if (onRefresh) await onRefresh();
      } catch (error) {
        toast.dismiss(loadingToast);
        const err = error as any;
        toast.error(
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update contact details"
        );
      }
    };

    save();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-[slideUp_0.3s_ease-out]">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl font-bold text-k-dark-grey">Contact Details</h2>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <FormField
            label="Region"
            name="region"
            value={formData.region}
            onChange={handleChange}
            disabled={!isEditing}
          />

          <FormField
            label="City"
            name="city"
            value={formData.city}
            onChange={handleChange}
            disabled={!isEditing}
          />

          <FormField
            label="Sub City"
            name="subCity"
            value={formData.subCity}
            onChange={handleChange}
            disabled={!isEditing}
          />

          <FormField
            label="Woreda"
            name="woreda"
            value={formData.woreda}
            onChange={handleChange}
            disabled={!isEditing}
          />

          <FormField
            label="House Number"
            name="houseNumber"
            value={formData.houseNumber}
            onChange={handleChange}
            disabled={!isEditing}
          />
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-k-dark-grey">
              Phone Numbers
            </h3>
            {isEditing && (
              <Button
                type="button"
                variant="link"
                onClick={addPhone}
                icon={MdAdd}
                className="text-primary hover:bg-primary-light"
              >
                Add Phone
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {formData.phones.map((phone, index) => (
              <div
                key={index}
                className="flex gap-4 items-start bg-gray-50 p-4 rounded-xl"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                  <FormField
                    label="Phone Number"
                    name={`phones.${index}.number`}
                    value={phone.number}
                    onChange={(e) =>
                      handlePhoneChange(index, "number", e.target.value)
                    }
                    disabled={!isEditing}
                    icon={MdPhone}
                    placeholder="+251..."
                  />
                  <FormField
                    label="Type"
                    type="select"
                    name={`phones.${index}.type`}
                    value={phone.type}
                    onChange={(e) =>
                      handlePhoneChange(index, "type", e.target.value)
                    }
                    disabled={!isEditing}
                    options={[
                      { value: "Private", label: "Private" },
                      { value: "Work", label: "Work" },
                      { value: "Home", label: "Home" },
                    ]}
                  />
                </div>
                {isEditing && formData.phones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePhone(index)}
                    className="mt-8 text-error hover:bg-red-50 p-2 rounded-lg transition-colors"
                  >
                    <MdDelete size={20} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>


        <div className="mb-8 border-t pt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-k-dark-grey flex items-center gap-2">
              <MdPerson /> Emergency Contacts
            </h3>
            {isEditing && (
              <Button
                type="button"
                variant="link"
                onClick={addEmergencyContact}
                icon={MdAdd}
                className="text-primary hover:bg-primary-light"
              >
                Add Contact
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-6">
              {formData.emergencyContacts.map((contact, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-xl relative border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      label="Full Name"
                      name={`ec.${index}.fullName`}
                      value={contact.fullName}
                      onChange={(e) => handleEmergencyContactChange(index, "fullName", e.target.value)}
                      icon={MdPerson}
                      required
                    />
                    <FormField
                      label="Relationship"
                      name={`ec.${index}.relationship`}
                      value={contact.relationship}
                      onChange={(e) => handleEmergencyContactChange(index, "relationship", e.target.value)}
                      required
                    />
                    <FormField
                      label="Phone Number"
                      name={`ec.${index}.phoneNumber`}
                      value={contact.phoneNumber}
                      onChange={(e) => handleEmergencyContactChange(index, "phoneNumber", e.target.value)}
                      icon={MdPhone}
                      required
                    />
                    <FormField
                      label="Email"
                      name={`ec.${index}.email`}
                      value={contact.email}
                      onChange={(e) => handleEmergencyContactChange(index, "email", e.target.value)}
                      icon={MdEmail}
                    />
                  </div>

                  <div className="mt-4 flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="primaryEmergencyContact"
                        checked={contact.isPrimary}
                        onChange={() => {
                          const newContacts = formData.emergencyContacts.map((c, i) => ({
                            ...c,
                            isPrimary: i === index
                          }));
                          setFormData(prev => ({ ...prev, emergencyContacts: newContacts }));
                        }}
                        className="w-4 h-4 text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className="text-sm font-medium text-gray-700">Primary Emergency Contact</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeEmergencyContact(index)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-error hover:bg-red-50 p-2 rounded-lg transition-all"
                    title="Remove Contact"
                  >
                    <MdDelete size={20} />
                  </button>
                </div>
              ))}
              {formData.emergencyContacts.length === 0 && (
                <p className="text-error italic text-center py-4 bg-red-50 rounded-xl border border-red-100 flex items-center justify-center gap-2">
                  <MdError /> At least one emergency contact is required.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.emergencyContacts.length > 0 ? (
                formData.emergencyContacts.map((contact, idx) => (
                  <div key={idx} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                      <FiUser className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-gray-900 leading-tight">{contact.fullName}</p>
                          {contact.isPrimary && (
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 capitalize">{contact.relationship}</p>
                      </div>

                      <div className="pt-2 border-t border-gray-50 space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <FiPhone className="w-4 h-4 text-gray-400" />
                          <span>{contact.phoneNumber}</span>
                        </div>
                        {contact.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <FiMail className="w-4 h-4 text-gray-400" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic col-span-full text-center">No emergency contacts found.</p>
              )}
            </div>
          )}
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
