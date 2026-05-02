import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import Button from "../Core/ui/Button";
import FormField from "./FormField";

export interface CreateItemFieldConfig {
  name: string;
  label: string;
  type?: "text" | "select" | "checkbox" | "textarea";
  options?: { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
}

interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fields: CreateItemFieldConfig[];
  onSubmit: (values: Record<string, any>) => Promise<void>;
  initialValues?: Record<string, any>;
}

export default function CreateItemModal({
  isOpen,
  onClose,
  title,
  fields,
  onSubmit,
  initialValues = {},
}: CreateItemModalProps) {
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  // Initialize form values
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, any> = {};
      fields.forEach((field) => {
        initial[field.name] =
          initialValues[field.name] || field.defaultValue || "";
      });
      setFormValues(initial);
    }
  }, [isOpen, fields, initialValues]);

  const handleChange = (name: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formValues);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.name} className={field.type === "checkbox" ? "flex items-center gap-2" : ""}>
            {field.type === "checkbox" ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formValues[field.name]}
                  onChange={(e) => handleChange(field.name, e.target.checked)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="text-gray-700 font-medium">{field.label}</span>
              </label>
            ) : (
              <FormField
                label={field.label}
                name={field.name}
                type={field.type || "text"}
                value={formValues[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                required={field.required}
                placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                options={field.options}
                autoFocus={field === fields[0]}
              />
            )}
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
