// backend/src/services/cloudinaryService.ts
import axios from 'axios';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

export const uploadToCloudinary = async (buffer: Buffer, originalName: string): Promise<string> => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration missing. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in .env');
  }

  // Always add a timestamp to make the public_id unique
  const basePublicId = originalName.replace(/\.[^/.]+$/, '');
  const timestamp = Date.now();
  const uniquePublicId = `${basePublicId}_${timestamp}`;

  const uint8Array = new Uint8Array(buffer);
  const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
  const formData = new FormData();
  formData.append('file', blob, originalName);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'employee_documents');
  formData.append('public_id', uniquePublicId);
  formData.append('resource_type', 'auto');

  const response = await axios.post(CLOUDINARY_URL, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 5 * 60 * 1000,
  });

  return response.data.secure_url;
};
