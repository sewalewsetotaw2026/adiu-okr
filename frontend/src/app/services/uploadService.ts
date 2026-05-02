import axios from 'axios';
import makeCall from '../API';
import apiRoutes from '../API/apiRoutes';
import { sanitizeFilename } from '../../utils/fileUtils';

export const uploadService = {
  /**
   * 1. Get Signed URL from Backend
   */
  getSignedUploadUrl: async (fileName: string, fileType: string) => {
    const response = await makeCall({
      route: apiRoutes.upload + '/signed-url', // Assuming apiRoutes.upload is '/api/v1/upload'
      method: "POST",
      body: { fileName, fileType },
      isSecureRoute: true,
    });
    return response.data; // Expected: { status: 'success', data: { signedUrl, token, path } }
  },

  /**
   * 2. Upload file to Supabase using Signed URL
   */
  uploadToSupabase: async (signedUrl: string, file: File) => {
    return await axios.put(signedUrl, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    });
  },

  /**
   * Orchestrator: Handles the full Triangular Upload flow
   * Returns the 'path' to be sent to the backend.
   */
  uploadFile: async (file: File): Promise<string> => {
    try {
      // Step 1: Get Token & URL
      const sanitizedName = sanitizeFilename(file.name);
      const { data } = await uploadService.getSignedUploadUrl(sanitizedName, file.type);
      const { signedUrl, path } = data;

      if (!signedUrl || !path) {
        throw new Error("Failed to retrieve signed upload URL");
      }

      // Step 2: Upload to Cloud
      await uploadService.uploadToSupabase(signedUrl, file);

      // Return the internal path for backend verification
      return path;
    } catch (error) {
      console.error("Upload Service Error:", error);
      throw error;
    }
  }
};
