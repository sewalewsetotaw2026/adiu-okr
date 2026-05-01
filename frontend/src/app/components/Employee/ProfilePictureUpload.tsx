import { useState, useRef } from "react";
import { MdCameraAlt, MdEdit } from "react-icons/md";
import employeeService from "../../services/employeeService";
import { uploadFile } from "../../services/fileUploadService";
import toast from "react-hot-toast";
// HrisSpinner replaced by generic spinner
import { getFileUrl } from "../../utils/fileUtils";
import Modal from "../Core/ui/Modal";

interface ProfilePictureUploadProps {
    employeeId: string;
    currentUrl: string | null;
    onUpdate: (newUrl: string) => void;
    isEditable?: boolean;
    size?: string;
}

export default function ProfilePictureUpload({ employeeId, currentUrl, onUpdate, isEditable = true, size = "w-32 h-32" }: ProfilePictureUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith("image/")) {
            toast.error("Please upload an image file");
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB
            toast.error("Image size must be less than 5MB");
            return;
        }

        // Create preview
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        setSelectedFile(file);
        setIsModalOpen(true); // Ensure modal is open to show preview

        // Reset input to allow selecting same file again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSave = async () => {
        if (!selectedFile) return;

        try {
            setIsUploading(true);

            // 1. Upload file directly to Cloudinary
            const url = await uploadFile(selectedFile);

            if (!url) throw new Error("Failed to get URL from Cloudinary");

            // 2. Update backend with the new URL
            const updateRes = await employeeService.updateProfilePicture(employeeId, url);

            // Extract URL from update response
            const finalUrl = updateRes?.data?.data?.profile_picture_url || updateRes?.data?.profile_picture_url || url;

            onUpdate(finalUrl);
            toast.success("Profile picture updated");
            handleCloseModal();
        } catch (error: any) {
            console.error("Failed to upload profile picture", error);
            const errorMessage = error?.message || "Failed to update profile picture";
            toast.error(errorMessage);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        // Clear preview after a short delay or immediately? 
        // Better to clear immediately to reset state.
        setPreviewUrl(null);
        setSelectedFile(null);
    };

    const displayUrl = previewUrl || (currentUrl ? getFileUrl(currentUrl) : "");

    return (
        <div className="relative inline-block">
            <div
                className={`${size} rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-100 relative group`}
            >
                {/* Image Area - Click to View */}
                <div
                    className={`w-full h-full ${currentUrl && !imageError ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                        if (currentUrl && !imageError) {
                            setIsModalOpen(true);
                        }
                    }}
                >
                    {currentUrl && !imageError ? (
                        <img
                            src={getFileUrl(currentUrl)}
                            alt="Profile"
                            className="w-full h-full object-cover rounded-full transition-transform duration-300 group-hover:scale-110"
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <MdCameraAlt size={40} />
                        </div>
                    )}
                </div>

                {isUploading && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-20 rounded-full pointer-events-none overflow-hidden">
                        <div className="absolute inset-0 shimmer-bg opacity-40" />
                    </div>
                )}
            </div>

            {/* Edit Button - Overlay (Outside Overflow Hidden) */}
            {isEditable && (
                <div
                    className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark hover:scale-110 transition-all cursor-pointer z-10"
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent opening image
                        if (!isUploading) {
                            fileInputRef.current?.click();
                        }
                    }}
                    title="Change Profile Picture"
                >
                    <MdEdit size={16} />
                </div>
            )}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />

            {/* View/Edit Image Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={previewUrl ? "Preview Profile Picture" : "Profile Picture"}
                className="max-w-xl w-full"
            >
                <div className="flex flex-col items-center gap-6">
                    <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-8 border-gray-100 shadow-inner">
                        {displayUrl ? (
                            <img
                                src={displayUrl}
                                alt="Profile Full View"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400">
                                <MdCameraAlt size={64} />
                            </div>
                        )}

                        {isUploading && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-20 overflow-hidden">
                                <div className="absolute inset-0 shimmer-bg opacity-40" />
                            </div>
                        )}
                    </div>

                    {isEditable && (
                        <div className="flex gap-4">
                            {previewUrl ? (
                                <>
                                    <button
                                        onClick={() => {
                                            setPreviewUrl(null);
                                            setSelectedFile(null);
                                        }}
                                        className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-full transition-all"
                                        disabled={isUploading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-full font-medium shadow-md hover:bg-primary-dark hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                        disabled={isUploading}
                                    >
                                        {isUploading ? "Updating..." : "Update Profile Picture"}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-medium shadow-md hover:bg-primary-dark hover:shadow-lg transition-all"
                                >
                                    <MdEdit size={18} />
                                    Change Photo
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
