import axios from "axios";
import { sanitizeFilename } from "../../utils/fileUtils";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Base URL for Cloudinary Image Upload API
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

// Default timeout: 5 minutes (300000ms) for large files
const DEFAULT_TIMEOUT = 5 * 60 * 1000;

/**
 * Uploads a file to Cloudinary with timeout and cancellation support
 * @param {File} file - The file object to upload
 * @param {Object} options - Upload options
 * @param {AbortSignal} options.signal - AbortSignal for cancelling the upload
 * @param {number} options.timeout - Timeout in milliseconds (default: 5 minutes)
 * @returns {Promise<string>} - The secure URL of the uploaded file
 */
export const uploadFile = async (file, options = {}) => {
  if (!file) {
    throw new Error("No file provided for upload");
  }

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.error("Cloudinary configuration missing");
    throw new Error(
      "Cloudinary configuration missing. Please check your .env file.",
    );
  }

  const { signal, timeout = DEFAULT_TIMEOUT } = options;
  const sanitizedName = sanitizeFilename(file.name);

  // Ensure we have a valid MIME type, fallback to application/octet-stream if missing
  // But if it ends in .pdf, try to force application/pdf which helps Cloudinary
  let mimeType = file.type;
  if (!mimeType && sanitizedName.toLowerCase().endsWith(".pdf")) {
    mimeType = "application/pdf";
  }

  // Create a new File object with the sanitized name to ensure the browser/API uses it
  const sanitizedFile = new File([file], sanitizedName, {
    type: mimeType || "application/octet-stream",
  });

  const formData = new FormData();
  formData.append("file", sanitizedFile);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("resource_type", "auto");

  try {
    const response = await axios.post(CLOUDINARY_URL, formData, {
      signal, // Pass AbortSignal to axios for cancellation
      timeout, // Axios timeout for network timeout handling
    });

    return response.data.secure_url;
  } catch (error) {
    // Handle cancellation
    if (axios.isCancel(error) || (signal && signal.aborted)) {
      throw new Error("Upload cancelled");
    }

    // Handle timeout
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      throw new Error(
        "Upload timeout: Network request took too long. Please check your connection and try again.",
      );
    }

    // Handle network errors
    if (error.message === "Network Error" || !error.response) {
      throw new Error(
        "Network error: Please check your internet connection and try again.",
      );
    }

    console.error("Error uploading file to Cloudinary:", error);

    // Extract detailed error message from Cloudinary if available
    const cloudinaryError = error.response?.data?.error?.message;
    if (cloudinaryError) {
      throw new Error(cloudinaryError);
    }

    throw error;
  }
};

export default {
  uploadFile,
};
