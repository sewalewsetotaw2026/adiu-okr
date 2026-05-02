import FileUpload from "../../../Core/ui/FileUpload";

interface StepProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
  errors: any;
}

export default function StepDocuments({ formData, updateFormData, errors }: StepProps) {
  const handleFileChange = (category: string, file: File | null) => {
    if (file) {
      // Append new files to existing ones if array, but FileUpload handles single now?
      // Wait, renderUploadSection says multiple=true usually. 
      // FileUpload implies single file per instance component based on props (file, NOT files).
      // Ah, StepDocuments handles Arrays of files (CVs, Photos). 
      // My FileUpload component is designed for SINGLE file.
      // Re-reading StepDocuments... it supported multiple files for CVs.
      // But for consistency and simplicity in the wizard, most inputs are single.
      // Let's adapt FileUpload or use multiple instances?
      // Actually, the new requirement "see the upload thing" implies a single detailed card.
      // Let's stick to the list logic but using file upload for "adding"?
      // Or simplify to single file per category for now to match other steps?
      // The requirement was "standardize". Other steps are single file. 
      // Let's refactor StepDocuments to use an array of FileUploads or a list?

      // Let's keep it simple: Add to list.
      const currentFiles = formData.documents[category] || [];
      const newFiles = [...currentFiles, file];
      updateFormData("documents", {
        ...formData.documents,
        [category]: newFiles,
      });
    }
  };

  const removeFile = (category: string, index: number) => {
    const currentFiles = formData.documents[category] || [];
    const newFiles = currentFiles.filter((_: any, i: number) => i !== index);
    updateFormData("documents", {
      ...formData.documents,
      [category]: newFiles,
    });
  };

  const renderUploadSection = (
    category: string,
    label: string,
    required: boolean = false
  ) => {
    const files = formData.documents[category] || [];
    const error = errors[category];

    return (
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
        <div className="mb-4">
          <h4 className="text-lg font-medium text-gray-800">
            {label} {required && <span className="text-red-500">*</span>}
          </h4>
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>

        <div className="space-y-3 mb-3">
          {files.map((fileItem: any, index: number) => {
            const isFileInstance = fileItem instanceof File;
            return (
              <div key={index}>
                <FileUpload
                  label={`File ${index + 1}`}
                  file={isFileInstance ? fileItem : null}
                  currentUrl={!isFileInstance ? (fileItem.url || fileItem.document_url || fileItem.documentUrl) : undefined}
                  onFileChange={() => { }} // Existing files in list don't change here
                  onRemove={() => removeFile(category, index)}
                />
              </div>
            );
          })}
        </div>

        {/* Upload New File */}
        {/* We always show one empty uploader to add more? Or limit to 1?
            The previous implementation allowed multiple. 
            Let's allow adding one at a time. 
        */}
        <div className="mt-2">
          <p className="text-sm font-medium text-gray-700 mb-2">Add New File</p>
          <FileUpload
            label=""
            file={null}
            onFileChange={(file) => handleFileChange(category, file)}
            onRemove={() => { }}
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>
      </div>
    );
  };

  // Wait, reusing FileUpload for the list items is tricky because FileUpload includes the Dropzone when file is null.
  // When file is present, it shows the card. 
  // So yes, mapping files to <FileUpload file={f} /> works to show the card.

  return (
    <div className="space-y-6 animate-[slideUp_0.3s_ease-out]">
      {/* Simplify: Only 1 file for Photo/ID usually needed. CV maybe 1. 
            Let's stick to the multiple support but cleaner. 
        */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderUploadSection("cv", "CV / Resume", true)}
        {renderUploadSection("nationalId", "National ID / Passport", true)}
        {renderUploadSection("guaranteeLetter", "Guarantee Letter")}
        {renderUploadSection("medicalCertificate", "Medical Certificate")}
        {renderUploadSection("policeCertificate", "Police Certificate")}

      </div>
    </div>
  );
}
