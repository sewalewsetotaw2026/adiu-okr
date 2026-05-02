import React, { useEffect, useState } from "react";
import Button from "../../../components/Core/ui/Button";
import { FiSettings, FiFileText } from "react-icons/fi";
import makeCall from "../../../API";
import apiRoutes from "../../../API/apiRoutes";
import toast from "react-hot-toast";
import DocumentConfigModal from "./DocumentConfigModal";
import { ImageCropperModal } from "../../../components/common/ImageCropperModal";
import { useFileUpload } from "../../../hooks/useFileUpload";
import { FiX, FiImage } from "react-icons/fi";

export default function DocumentSettings() {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { uploadFileImmediately, getUploadState } = useFileUpload();
  const isUploading = getUploadState("company-stamp")?.uploading;

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const configRes = await makeCall({
        route: apiRoutes.documentSignerConfig,
        method: "GET",
        isSecureRoute: true,
      });

      if (configRes?.data?.data) {
        const configMap: Record<string, any> = {};
        configRes.data.data.forEach((conf: any) => {
          configMap[conf.document_type] = conf;
        });
        setConfigs(configMap);
      }

      // Fetch current company details via the /me route (to avoid 403)
      const companyRes = await makeCall({
        route: apiRoutes.myCompany,
        method: "GET",
        isSecureRoute: true,
      });

      if (companyRes?.data?.data?.company) {
        setStampUrl(companyRes.data.data.company.stamp_url);
      }
    } catch (error) {
      console.error("Failed to load configs", error);
      toast.error("Failed to refresh settings");
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Stamp file size should be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = async (croppedFile: File) => {
    setShowCropper(false);
    try {
      const url = await uploadFileImmediately(croppedFile, "company-stamp");
      if (url) {
        await makeCall({
          route: apiRoutes.myCompany,
          method: "PATCH",
          body: { stampUrl: url },
          isSecureRoute: true,
        });
        setStampUrl(url);
        toast.success("Company stamp updated successfully");
      }
    } catch (error) {
      console.error("Upload failed", error);
    }
  };

  const DOCUMENT_TYPES = [
    { value: "CERTIFICATE_OF_SERVICE", label: "Certificate of Service" },
    { value: "CERTIFICATE_OF_SERVICE_RESIGNED", label: "Certificate of Service (Resigned)" }
  ];

  useEffect(() => {
    fetchConfigs();
  }, []);

  if (loading && Object.keys(configs).length === 0) {
    return <div className="p-8 text-center text-gray-500">Loading document settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Document Configuration</h2>
          <p className="text-sm text-gray-500">Manage signatories for official documents.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} icon={FiSettings}>
          Configure Signer
        </Button>
      </div>

      {/* Configured Documents List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DOCUMENT_TYPES.map(doc => {
          const config = configs[doc.value];
          return (
            <div key={doc.value} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <FiFileText size={24} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">{doc.label}</h4>
                {config ? (
                  <div className="mt-2 text-sm text-gray-600">
                    <p><span className="font-medium text-gray-900">Signer:</span> {config.employee?.full_name}</p>
                    <p className="text-xs text-gray-500 mt-1">{config.signer_title}</p>
                    {config.employee?.signature_url && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Signature Active
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm italic text-gray-400">
                    Using default Human Resources signer
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Company Stamp Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3 text-gray-800">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <FiSettings size={20} />
          </div>
          <h3 className="text-lg font-bold">Company Stamp</h3>
        </div>
        <p className="text-sm text-gray-500">
          This stamp will be displayed on all official documents generated by the system.
        </p>

        <div className="flex items-center gap-6">
          <div className="relative w-32 h-32 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden group">
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-gray-400">Uploading...</span>
              </div>
            ) : stampUrl ? (
              <>
                <img src={stampUrl} alt="Company Stamp" className="w-full h-full object-contain p-2" />
                <button
                  onClick={() => setStampUrl(null)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <FiX size={12} />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center text-gray-400">
                <FiImage size={24} />
                <span className="text-[10px] mt-1">No stamp</span>
              </div>
            )}
            <input
              type="file"
              id="stamp-upload"
              hidden
              accept="image/*"
              onChange={handleImageSelect}
              disabled={!!isUploading}
            />
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => document.getElementById("stamp-upload")?.click()}
              variant="outline"
              loading={isUploading}
            >
              {stampUrl ? "Change Stamp" : "Upload Stamp"}
            </Button>
            <p className="text-xs text-gray-400">Recommended: Transparent PNG, square aspect ratio.</p>
          </div>
        </div>
      </div>

      {showCropper && selectedFile && (
        <ImageCropperModal
          image={selectedFile}
          onCropComplete={onCropComplete}
          onCancel={() => setShowCropper(false)}
        />
      )}

      {/* Configuration Modal */}
      <DocumentConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={() => {
          fetchConfigs(); // Refresh list on save
        }}
      />
    </div>
  );
}
