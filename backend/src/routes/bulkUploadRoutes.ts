import { Router } from "express";
import multer from "multer";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { ActionTypes, Resources } from "src/utils/constants";
import {
  bulkUploadAllEmployeeData,
  bulkUploadFromFiles,
  bulkUploadFromFolder,
  bulkUploadWithFiles,
} from "src/controllers/bulkUploadController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.post(
  "/bulk-upload",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY),
  bulkUploadAllEmployeeData
);

router.post(
  "/bulk-upload-file",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY),
  bulkUploadFromFiles
);

router.post(
  "/folder",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY),
  bulkUploadFromFolder
);

router.post(
  "/upload-files",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY),
  upload.array('files'),
  bulkUploadWithFiles
);

export default router;
