import React, { useEffect, useState } from "react";
import StepDocuments from "../../../../components/employees/wizard/StepDocuments";
import toast from "react-hot-toast";
import onboardingService from "../../../../services/onboardingService";
import { FiFileText, FiExternalLink } from "react-icons/fi";

// Helper Component for View Link
const ViewLink = ({ url, label }: { url: string; label?: string }) => {
  const normalizeExternalUrl = (url: string) => {
    const trimmed = String(url || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const href = normalizeExternalUrl(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-xs flex items-center gap-1 text-primary hover:underline font-medium bg-primary-light px-2 py-1 rounded"
    >
      <FiExternalLink /> {label || "View"}
    </a>
  );
};

export default function DocumentsWrapper({ initialDocuments, onRefresh }: any) {
  // State for NEW documents only
  const [newDocuments, setNewDocuments] = useState({
    documents: {
      cv: [],
      certificates: [],
      photo: [],
      experienceLetters: [],
      taxForms: [],
      pensionForms: [],
      nationalId: [],
      guaranteeLetter: [],
      medicalCertificate: [],
      policeCertificate: [],
    },
  });

  const [errors, setErrors] = useState({});
  const [existingDocs, setExistingDocs] = useState<any>(null);

  useEffect(() => {
    if (initialDocuments) {
      setExistingDocs(initialDocuments);
    }
  }, [initialDocuments]);

  const updateFormData = (field: string, value: any) => {
    if (field === "documents") {
      setNewDocuments((prev) => {
        const currentDocs = prev?.documents || {};
        const nextDocs =
          typeof value === "function" ? value(currentDocs) : value;
        return { ...prev, documents: nextDocs || {} };
      });
    } else {
      setNewDocuments((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const loadingToast = toast.loading("Saving documents...");

    try {
      const extractUrl = (item: any) => {
        if (!item) return null;
        if (typeof item === "string") return item;
        if (item.url) return item.url;
        return null;
      };

      const getExisting = (key: string) => {
        if (!initialDocuments) return [];

        // If Array (Profile Detail format)
        if (Array.isArray(initialDocuments)) {
          return initialDocuments
            .filter((d: any) => {
              const type = (d.document_type || "").toLowerCase();
              if (key === "cv")
                return (
                  type.includes("cv") ||
                  type.includes("resume") ||
                  type.includes("curriculum")
                );
              if (key === "nationalId")
                return (
                  type.includes("national") ||
                  type.includes("passport") ||
                  type.includes("id")
                );
              if (key === "guaranteeLetter") return type.includes("guarantee");
              if (key === "medicalCertificate") return type.includes("medical");
              if (key === "policeCertificate")
                return type.includes("police") || type.includes("forensic");
              if (key === "certificates")
                return (
                  type.includes("certificate") &&
                  !type.includes("medical") &&
                  !type.includes("police")
                );
              if (key === "photo")
                return type.includes("photo") || type.includes("picture");

              return type.includes(key.toLowerCase());
            })
            .map(extractUrl);
        }

        // If Object (Onboarding / Profile Edit format - keys match Prisma Schema or snake_case variants)
        // We check both camelCase key provided and snake_case variant to be safe
        const snakeKey = key.replace(
          /[A-Z]/g,
          (letter) => `_${letter.toLowerCase()}`,
        );
        return (
          (initialDocuments as any)[key] ||
          (initialDocuments as any)[snakeKey] ||
          []
        );
      };

      const newErrors: any = {};
      const newDocs = newDocuments.documents as any;

      // Helper to check if doc exists in either existing or new
      const hasDoc = (key: string) => {
        const existing = getExisting(key);
        if (existing && existing.length > 0) return true;

        const newItems = newDocs[key];
        const validNew =
          newItems &&
          Array.isArray(newItems) &&
          newItems.some((item: any) => {
            if (typeof item === "string") return true;
            return (
              (item.url || item.document_url || item instanceof File) &&
              !item.error
            );
          });
        return !!validNew;
      };

      if (!hasDoc("cv")) newErrors.cv = "CV/Resume is required";
      if (!hasDoc("nationalId"))
        newErrors.nationalId = "National ID is required";
      if (!hasDoc("guaranteeLetter"))
        newErrors.guaranteeLetter = "Guarantee Letter is required";
      if (!hasDoc("medicalCertificate"))
        newErrors.medicalCertificate = "Medical Certificate is required";
      if (!hasDoc("policeCertificate"))
        newErrors.policeCertificate = "Police Certificate is required";

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        toast.dismiss(loadingToast);
        toast.error(
          "Please upload all required documents (CV, National ID, Guarantee Letter, Medical & Police Certificates)",
        );
        return;
      }

      // Helper to merge lists
      const mergeLists = (existingList: any, newList: any) => {
        const toArray = (v: any) => {
          if (Array.isArray(v)) return v;
          if (v && typeof v === "object" && v.url) return [v];
          if (v && typeof v === "string") return [v];
          return [];
        };

        const oldItems = toArray(existingList).map(extractUrl).filter(Boolean);
        const newItems = toArray(newList).map(extractUrl).filter(Boolean);

        return [...new Set([...oldItems, ...newItems])];
      };

      // PAYLOAD must match Prisma Schema keys exactly
      const payloadDocs = {
        cv: mergeLists(getExisting("cv"), newDocs.cv),
        certificates: mergeLists(
          getExisting("certificates"),
          newDocs.certificates,
        ),
        photo: mergeLists(getExisting("photo"), newDocs.photo),
        experienceLetters: mergeLists(
          getExisting("experienceLetters"),
          newDocs.experienceLetters,
        ),
        taxForms: mergeLists(getExisting("taxForms"), newDocs.taxForms),
        pensionForms: mergeLists(
          getExisting("pensionForms"),
          newDocs.pensionForms,
        ),

        // Snake Case Keys required by Backend
        national_id: mergeLists(getExisting("nationalId"), newDocs.nationalId),
        guarantee_letter: mergeLists(
          getExisting("guaranteeLetter"),
          newDocs.guaranteeLetter,
        ),
        medical_certificate: mergeLists(
          getExisting("medicalCertificate"),
          newDocs.medicalCertificate,
        ),
        police_certificate: mergeLists(
          getExisting("policeCertificate"),
          newDocs.policeCertificate,
        ),
      };

      await onboardingService.updateDocuments({ documents: payloadDocs });

      toast.dismiss(loadingToast);
      toast.success("Documents updated successfully");

      // Clear new docs
      setNewDocuments({
        documents: {
          cv: [],
          certificates: [],
          photo: [],
          experienceLetters: [],
          taxForms: [],
          pensionForms: [],
          nationalId: [],
          guaranteeLetter: [],
          medicalCertificate: [],
          policeCertificate: [],
        },
      });

      if (onRefresh) await onRefresh();
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update documents",
      );
    }
  };

  // Render Logic (Admin Style)
  const renderExistingDocuments = () => {
    const raw = existingDocs;
    if (!raw)
      return <p className="text-gray-500 italic">No documents on file.</p>;

    const extractUrl = (v: any) => {
      if (!v) return "";
      if (typeof v === "string") return v;
      return v.document_url || v.url || v.fileUrl || "";
    };

    // Format A: Array
    if (Array.isArray(raw)) {
      const items = raw
        .map((d: any) => ({
          label: d.file_name || d.name || d.document_type || "Document",
          type: d.document_type || "",
          url: extractUrl(d),
        }))
        .filter((d) => d.url);

      if (items.length === 0)
        return <p className="text-gray-500 italic">No documents on file.</p>;

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((doc: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded border border-gray-100"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FiFileText className="text-primary" />
                  <span className="text-sm font-bold text-gray-800 truncate">
                    {doc.label}
                  </span>
                </div>
                {doc.type && (
                  <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-1">
                    {doc.type}
                  </div>
                )}
              </div>
              <ViewLink url={doc.url} label="View" />
            </div>
          ))}
        </div>
      );
    }

    // Format B: Object (Bucket)
    if (typeof raw === "object") {
      const buckets = [
        { key: "cv", snakeKey: "cv", label: "CV" },
        {
          key: "nationalId",
          snakeKey: "national_id",
          label: "National ID / Passport",
        },
        {
          key: "guaranteeLetter",
          snakeKey: "guarantee_letter",
          label: "Guarantee Letter",
        },
        {
          key: "medicalCertificate",
          snakeKey: "medical_certificate",
          label: "Medical Certificate",
        },
        {
          key: "policeCertificate",
          snakeKey: "police_certificate",
          label: "Police Certificate",
        },
        {
          key: "certificates",
          snakeKey: "certificates",
          label: "Certificates",
        },
        { key: "photo", snakeKey: "photo", label: "Photo" },
        {
          key: "experienceLetters",
          snakeKey: "experience_letters",
          label: "Experience Letters",
        },
        { key: "taxForms", snakeKey: "tax_forms", label: "Tax Forms" },
        {
          key: "pensionForms",
          snakeKey: "pension_forms",
          label: "Pension Forms",
        },
      ];

      // Filter out empty buckets
      const rows = buckets
        .map((b) => {
          const list = raw[b.key] || raw[b.snakeKey];
          const urls = (Array.isArray(list) ? list : list ? [list] : [])
            .map(extractUrl)
            .filter(Boolean);
          return { ...b, urls };
        })
        .filter((r) => r.urls.length > 0);

      if (rows.length === 0)
        return <p className="text-gray-500 italic">No documents on file.</p>;

      return (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.key}
              className="p-4 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="flex items-center gap-2 mb-2">
                <FiFileText className="text-primary" />
                <h3 className="font-bold text-gray-900">{row.label}</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {row.urls.map((url, idx) => (
                  <ViewLink key={idx} url={url} label={`Link ${idx + 1}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return <p className="text-gray-500 italic">No documents on file.</p>;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="mb-6 border-b pb-4">
        <h2 className="text-xl font-bold text-k-dark-grey">Documents</h2>
        <p className="text-sm text-gray-500 mt-1">
          Existing documents cannot be deleted. You can upload new versions
          below.
        </p>
      </div>

      <div className="mb-8 p-4 border border-gray-100 rounded-xl bg-white shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FiFileText /> Existing Documents
        </h3>
        {renderExistingDocuments()}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiExternalLink className="rotate-180" /> Upload New Documents
          </h3>
          <StepDocuments
            formData={newDocuments}
            updateFormData={updateFormData}
            errors={errors}
            readOnlyExisting={true}
          />
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm shadow-primary/20"
          >
            Save New Documents
          </button>
        </div>
      </form>
    </div>
  );
}
