import React, { useRef, useEffect } from "react";
import toast from "react-hot-toast";
import UniversalFileUpload, { FileItem } from "../../Core/ui/UniversalFileUpload";

interface StepDocumentsProps {
  formData: {
    documents: {
      cv?: FileItem[] | string[];
      nationalId?: FileItem[] | string[];
      guaranteeLetter?: FileItem[] | string[];
      medicalCertificate?: FileItem[] | string[];
      policeCertificate?: FileItem[] | string[];
    };
  };
  updateFormData: (field: string, value: any) => void;
  errors?: {
    cv?: string | null;
    nationalId?: string | null;
    guaranteeLetter?: string | null;
    medicalCertificate?: string | null;
    policeCertificate?: string | null;
  };
  readOnlyExisting?: boolean;
}

export default function StepDocuments({
  formData,
  updateFormData,
  errors = {},
  readOnlyExisting = false,
}: StepDocumentsProps) {
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach((controller) => {
        controller.abort();
      });
    };
  }, []);

  const handleDocumentChange = (
    name: string,
    files: FileItem[] | ((prev: FileItem[]) => FileItem[])
  ) => {
    updateFormData("documents", (prevDocs: any) => {
        const safePrevDocs = prevDocs || {};
        const currentFiles = Array.isArray(safePrevDocs[name]) ? safePrevDocs[name] : [];
        const newFiles = typeof files === 'function' ? files(currentFiles) : files;
        return {
            ...safePrevDocs,
            [name]: newFiles,
        };
    });
  };

  const handleMultiFileChange = async (
    name: string,
    newFiles: File[]
  ) => {
    // 1. Prepare all new file items
    const newItems = newFiles.map(file => ({
      file,
      name: file.name,
      uploading: true,
      uploadId: `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));

    // 2. Add all items in one go using functional update
    handleDocumentChange(name, (prev: any[]) => [...prev, ...newItems]);

    // 3. Start individual uploads
    for (const newItem of newItems) {
      const { uploadId, file } = newItem;
      const abortController = new AbortController();
      abortControllersRef.current[uploadId] = abortController;

      try {
        const { uploadFile } = await import("../../../services/fileUploadService");
        const url = await uploadFile(file, {
          signal: abortController.signal,
          timeout: 5 * 60 * 1000,
        });

        if (abortController.signal.aborted) return;

        // 4. Update the item using functional update
        handleDocumentChange(name, (prev: any[]) => {
          const updated = [...prev];
          const itemIndex = updated.findIndex((item: any) => item.uploadId === uploadId);
          if (itemIndex > -1) {
            updated[itemIndex] = { ...updated[itemIndex], url, uploading: false };
          }
          return updated;
        });
        
        toast.success(`"${file.name}" uploaded successfully`);
      } catch (error: any) {
        if (error?.message === "Upload cancelled") return;
        
        const errorMessage = error?.message || "Upload failed";
        toast.error(`Failed to upload "${file.name}": ${errorMessage}`);
        
        // 5. Update error status using functional update
        handleDocumentChange(name, (prev: any[]) => {
          const updated = [...prev];
          const itemIndex = updated.findIndex((item: any) => item.uploadId === uploadId);
          if (itemIndex > -1) {
            updated[itemIndex] = { ...updated[itemIndex], error: errorMessage, uploading: false };
          }
          return updated;
        });
      } finally {
        delete abortControllersRef.current[uploadId];
      }
    }
  };

  const removeFile = (name: string, indexToRemove: number) => {
    const currentFiles = Array.isArray((formData.documents as any)[name]) 
        ? [...(formData.documents as any)[name]] 
        : [];
    const updated = currentFiles.filter((_, idx) => idx !== indexToRemove);
    handleDocumentChange(name, updated);
  };

  const cancelUpload = (name: string, index: number) => {
      const files = (formData.documents as any)[name] || [];
      const item = files[index];
      if (item?.uploadId && abortControllersRef.current[item.uploadId]) {
          abortControllersRef.current[item.uploadId].abort();
          delete abortControllersRef.current[item.uploadId];
          removeFile(name, index);
          toast("Upload cancelled");
      }
  }

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-800">
          Please upload clear, legible copies of your documents. Supported
          formats: PDF, DOCX, JPG, PNG.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UniversalFileUpload
          label="CV / Resume"
          files={(formData.documents.cv as any) || []}
          multiple={true}
          onFileChange={(files) => handleMultiFileChange("cv", files)}
          onRemove={(idx) => removeFile("cv", idx)}
          onCancel={(idx) => cancelUpload("cv", idx)}
          error={errors.cv || undefined}
          required
          lockExisting={readOnlyExisting}
        />

        <UniversalFileUpload
          label="National ID / Passport"
          files={(formData.documents.nationalId as any) || []}
          multiple={true}
          onFileChange={(files) => handleMultiFileChange("nationalId", files)}
          onRemove={(idx) => removeFile("nationalId", idx)}
          onCancel={(idx) => cancelUpload("nationalId", idx)}
          error={errors.nationalId || undefined}
          required
          lockExisting={readOnlyExisting}
        />

        <UniversalFileUpload
          label="Guarantee Letter"
          files={(formData.documents.guaranteeLetter as any) || []}
          multiple={true}
          onFileChange={(files) => handleMultiFileChange("guaranteeLetter", files)}
          onRemove={(idx) => removeFile("guaranteeLetter", idx)}
          onCancel={(idx) => cancelUpload("guaranteeLetter", idx)}
          error={errors.guaranteeLetter || undefined}
          required
          lockExisting={readOnlyExisting}
        />

        <UniversalFileUpload
          label="Medical Certificate"
          files={(formData.documents.medicalCertificate as any) || []}
          multiple={true}
          onFileChange={(files) => handleMultiFileChange("medicalCertificate", files)}
          onRemove={(idx) => removeFile("medicalCertificate", idx)}
          onCancel={(idx) => cancelUpload("medicalCertificate", idx)}
          error={errors.medicalCertificate || undefined}
          required
          lockExisting={readOnlyExisting}
        />

        <UniversalFileUpload
          label="Police / Forensic Certificate"
          files={(formData.documents.policeCertificate as any) || []}
          multiple={true}
          onFileChange={(files) => handleMultiFileChange("policeCertificate", files)}
          onRemove={(idx) => removeFile("policeCertificate", idx)}
          onCancel={(idx) => cancelUpload("policeCertificate", idx)}
          error={errors.policeCertificate || undefined}
          required
          lockExisting={readOnlyExisting}
        />
      </div>
    </div>
  );
}
