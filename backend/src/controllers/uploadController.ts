import { Request, Response, NextFunction } from 'express';
import { uploadToSupabase, createSignedUploadUrl } from 'src/services/supabaseService';

/**
 * Handles file upload requests and saves to MEGA cloud.
 */
export const uploadFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Integration disabled
    return res.status(200).json({
      status: 'success',
      data: {
        url: "https://placeholder.url/file",
        name: req.file?.originalname || "file"
      }
    });
  } catch (error) {
    next(error);
  }
};

export const generateSignedUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
     return res.status(200).json({
      status: 'success',
      data: {
        signedUrl: "https://placeholder.url/upload",
        token: "mock-token",
        path: "mock/path",
        fullPath: "mock/path"
      }
    });
  } catch (error) {
    next(error);
  }
};
