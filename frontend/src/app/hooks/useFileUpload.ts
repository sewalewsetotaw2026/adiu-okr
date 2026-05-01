import { useState } from 'react';
import { uploadFile } from '../services/fileUploadService';
import toast from 'react-hot-toast';

interface FileUploadState {
  uploading: boolean;
  error: string | null;
  progress: number;
}

interface FileWithUrl {
  file: File;
  url?: string;
  uploading?: boolean;
  error?: string;
}

export const useFileUpload = () => {
  const [uploadStates, setUploadStates] = useState<Record<string, FileUploadState>>({});

  const uploadFileImmediately = async (
    file: File,
    fileId: string
  ): Promise<string> => {
    // Set uploading state
    setUploadStates((prev) => ({
      ...prev,
      [fileId]: { uploading: true, error: null, progress: 0 },
    }));

    try {
      const url = await uploadFile(file);
      
      // Clear uploading state on success
      setUploadStates((prev) => {
        const newState = { ...prev };
        delete newState[fileId];
        return newState;
      });

      toast.success(`File "${file.name}" uploaded successfully`);
      return url;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to upload file';
      
      // Set error state
      setUploadStates((prev) => ({
        ...prev,
        [fileId]: { uploading: false, error: errorMessage, progress: 0 },
      }));

      toast.error(`Failed to upload "${file.name}": ${errorMessage}`);
      throw error;
    }
  };

  const getUploadState = (fileId: string): FileUploadState | undefined => {
    return uploadStates[fileId];
  };

  const clearUploadState = (fileId: string) => {
    setUploadStates((prev) => {
      const newState = { ...prev };
      delete newState[fileId];
      return newState;
    });
  };

  return {
    uploadFileImmediately,
    getUploadState,
    clearUploadState,
  };
};

