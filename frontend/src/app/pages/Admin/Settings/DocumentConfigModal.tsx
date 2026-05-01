import React, { useState, useEffect } from "react";
import Modal from "../../../components/Core/ui/Modal";
import Button from "../../../components/Core/ui/Button";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import toast from "react-hot-toast";
import FormAutocomplete from "../../../components/Core/ui/FormAutocomplete";
import employeeService from "../../../services/employeeService";

interface DocumentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function DocumentConfigModal({ isOpen, onClose, onSave }: DocumentConfigModalProps) {
  const [saving, setSaving] = useState(false);

  // Selection State
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDocType, setSelectedDocType] = useState<string>("CERTIFICATE_OF_SERVICE");

  // Signature check state
  const [isCheckingSignature, setIsCheckingSignature] = useState(false);
  const [hasSignature, setHasSignature] = useState<boolean | null>(null);

  const DOCUMENT_TYPES = [
    { value: "CERTIFICATE_OF_SERVICE", label: "Certificate of Service" },
    { value: "CERTIFICATE_OF_SERVICE_RESIGNED", label: "Certificate of Service (Resigned)" },
  ];

  // Custom fetch to show top employees initially or search by name
  const fetchSuggestions = async (query: string) => {
    try {
      // Base route with standard limits and active status
      let route = `${apiRoutes.employees}?page=1&limit=10&onboarding_status=COMPLETED&is_active=true`;

      // Append search query if it exists
      if (query) {
        route += `&search=${encodeURIComponent(query)}`;
      }

      const response = await makeCall({
        route,
        method: "GET",
        isSecureRoute: true,
      });

      // Extract employees from response
      const data = response?.data?.data?.employees ||
        response?.data?.employees ||
        [];

      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Failed to fetch suggestions", error);
      return [];
    }
  };

  // Check signature when employee is selected
  useEffect(() => {
    const checkSignature = async () => {
      if (!selectedEmployee) {
        setHasSignature(null);
        return;
      }

      setIsCheckingSignature(true);
      try {
        const response = await employeeService.getProfile(selectedEmployee);
        const employee = response?.data?.data?.employee || response?.data?.employee;

        if (employee?.signature_url) {
          setHasSignature(true);
        } else {
          setHasSignature(false);
        }
      } catch (error) {
        console.error("Failed to check signature", error);
        setHasSignature(false); // Assume false on error to be safe
      } finally {
        setIsCheckingSignature(false);
      }
    };

    checkSignature();
  }, [selectedEmployee]);

  const handleSave = async () => {
    if (!selectedEmployee) {
      toast.error("Please select an employee");
      return;
    }

    if (isCheckingSignature) {
      toast.error("Still verifying signature. Please wait...");
      return;
    }

    if (hasSignature === false) {
      toast.error("Selected employee does not have a signature configured!");
      return;
    }

    setSaving(true);
    try {
      await makeCall({
        route: apiRoutes.documentSignerConfig,
        method: "POST",
        isSecureRoute: true,
        body: {
          document_type: selectedDocType,
          signer_employee_id: selectedEmployee,
        },
      });

      toast.success("Configuration saved");
      onSave(); // Trigger parent refresh
      onClose();
    } catch (error: any) {
      console.error("Save failed", error);
      toast.error(error?.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configure Document Signer">
      <div className="space-y-6">

        {/* Employee Selection via Autocomplete */}
        <div>
          <FormAutocomplete
            label="Select Signer"
            placeholder="Search employee by name..."
            type="employees"
            value={selectedEmployeeName}
            onChange={setSelectedEmployeeName}
            onIdChange={setSelectedEmployee}
            required
            creatable={false}
            fetchSuggestionsFn={fetchSuggestions}
          />

          {/* Feedback Area */}
          <div className="mt-2 min-h-[20px]">
            {selectedEmployee && isCheckingSignature && (
              <p className="text-xs text-gray-500 animate-pulse">Checking signature...</p>
            )}

            {selectedEmployee && !isCheckingSignature && hasSignature === true && (
              <div className="flex items-center gap-2 text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-100">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Signature verified
              </div>
            )}

            {selectedEmployee && !isCheckingSignature && hasSignature === false && (
              <div className="flex items-center gap-2 text-xs text-red-600 font-medium bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                No signature found! Please upload one in employee profile.
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100"></div>

        {/* Document Selection */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Apply to Document</label>
          <select
            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary-light transition-all"
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedEmployee || isCheckingSignature || hasSignature !== true}
            loading={saving}
          >
            Save Configuration
          </Button>
        </div>

      </div>
    </Modal>
  );
}
