import React, { useState } from "react";
import platformService from "../../services/platformService";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FiUploadCloud, FiX, FiImage } from "react-icons/fi";
import { ImageCropperModal } from "../../components/common/ImageCropperModal";
import { COLOR_PALETTES, ColorPalette } from "../../constants/themeConstants";

export const RegisterCompany = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { uploadFileImmediately, getUploadState } = useFileUpload();
  const uploadingLogo = getUploadState("company-logo")?.uploading;
  const [formData, setFormData] = useState({
    companyName: "",
    companyCode: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    phone: "",
    companyEmail: "",
    address: "",
    logoUrl: "",
    primaryColor: "#e55400",
    secondaryColor: "#ffda00",
  });

  const [showCropper, setShowCropper] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const palettes = COLOR_PALETTES;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setSelectedFile(reader.result as string);
      setShowCropper(true);
    });
    reader.readAsDataURL(file);
  };

  const onCropComplete = async (croppedFile: File) => {
    setShowCropper(false);
    try {
      const url = await uploadFileImmediately(croppedFile, "company-logo");

      if (!url) {
        throw new Error("No URL returned from upload");
      }

      setFormData((prev: any) => ({ ...prev, logoUrl: url }));
      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload cropped logo");
    }
  };

  const removeLogo = () => {
    setFormData((prev: any) => ({ ...prev, logoUrl: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.companyCode || !formData.adminEmail || !formData.adminPassword) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setLoading(true);
      await platformService.registerCompany(formData);
      toast.success("Company registered successfully!");
      navigate("/super-admin/companies");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to register company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Register New Company</h2>

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Company Name *</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Company Code *</label>
              <input
                type="text"
                name="companyCode"
                value={formData.companyCode}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. ACME"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="+251..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Company Email</label>
              <input
                type="email"
                name="companyEmail"
                value={formData.companyEmail}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="info@company.com"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Company Logo</label>
            <div className="flex items-center space-x-4">
              <div className="relative w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50 group">
                {formData.logoUrl ? (
                  <>
                    <img
                      src={formData.logoUrl}
                      alt="Logo preview"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://placehold.co/100x100?text=Logo";
                      }}
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <FiX className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                    {uploadingLogo ? (
                      <div className="absolute inset-0 shimmer-bg opacity-30" />
                    ) : (
                      <>
                        <FiImage className="w-8 h-8 text-gray-400" />
                        <span className="text-[10px] text-gray-500 mt-1">Upload Logo</span>
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                  </label>
                )}
              </div>
              <div className="flex-1 text-xs text-gray-500">
                <p>Upload your company logo (max 2MB).</p>
                <p>Supported formats: JPG, PNG, SVG</p>
                {!formData.logoUrl && !uploadingLogo && (
                  <label className="inline-flex items-center mt-2 text-indigo-600 font-medium cursor-pointer hover:text-indigo-700">
                    <FiUploadCloud className="mr-1" />
                    Select File
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Admin Account Details</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Admin Full Name</label>
                <input
                  type="text"
                  name="adminName"
                  value={formData.adminName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Admin Email *</label>
                <input
                  type="email"
                  name="adminEmail"
                  value={formData.adminEmail}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="admin@company.com"
                />
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <label className="text-sm font-medium text-gray-700">Initial Password *</label>
              <input
                type="password"
                name="adminPassword"
                value={formData.adminPassword}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="********"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Company Theme Palette</label>
              <span className="text-xs text-gray-500 italic">
                {formData.primaryColor} / {formData.secondaryColor}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[320px] overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50/30">
              {palettes.map((palette: ColorPalette) => (
                <button
                  key={palette.name}
                  type="button"
                  onClick={() => setFormData((prev: any) => ({
                    ...prev,
                    primaryColor: palette.primary,
                    secondaryColor: palette.secondary
                  }))}
                  title={palette.description}
                  className={`relative p-2 rounded-lg border-2 transition-all flex flex-col items-center ${formData.primaryColor === palette.primary && formData.secondaryColor === palette.secondary
                    ? "border-indigo-600 bg-white shadow-sm ring-2 ring-indigo-500/10"
                    : "border-white hover:border-gray-200 bg-white"
                    }`}
                >
                  <div className="flex w-full h-8 rounded-md overflow-hidden mb-1.5 shadow-inner">
                    <div className="flex-1" style={{ backgroundColor: palette.primary }} />
                    <div className="flex-1" style={{ backgroundColor: palette.secondary }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-600 truncate w-full text-center">{palette.name}</span>
                  {formData.primaryColor === palette.primary && formData.secondaryColor === palette.secondary && (
                    <div className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm z-10">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Custom Color Selection */}
            <div className="mt-4 p-4 border border-indigo-100 rounded-xl bg-indigo-50/20">
              <h4 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2" />
                Custom Color Override
              </h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Primary Color</label>
                  <div className="flex items-center space-x-2">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] cursor-pointer p-0 border-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      placeholder="#000000"
                      className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white uppercase"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Secondary Color</label>
                  <div className="flex items-center space-x-2">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
                      <input
                        type="color"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] cursor-pointer p-0 border-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      placeholder="#000000"
                      className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>


          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => navigate("/super-admin/companies")}
              className="mr-4 px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Registering..." : "Register Company"}
            </button>
          </div>
        </form>
      </div>

      {showCropper && selectedFile && (
        <ImageCropperModal
          image={selectedFile}
          onCropComplete={onCropComplete}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </div>
  );
};
